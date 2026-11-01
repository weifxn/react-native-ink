import { PassThrough } from 'node:stream';

/**
 * Mouse input, which Ink has no notion of. The terminal is asked to report the mouse, and
 * answers in escape sequences on the stdin the keyboard writes to: those are taken out before
 * Ink reads it, which also keeps Ink from mistaking one for keys.
 */
export type MouseButton = 'left' | 'middle' | 'right';
export type WheelDirection = 'up' | 'down' | 'left' | 'right';

interface MouseEventBase {
  /** Where the pointer was, in 0-based columns and rows of the terminal window. */
  column: number;
  row: number;
  shift: boolean;
  meta: boolean;
  ctrl: boolean;
}

export type MouseEvent =
  | (MouseEventBase & { type: 'down' | 'up'; button: MouseButton })
  | (MouseEventBase & { type: 'wheel'; direction: WheelDirection });

/**
 * Report presses, releases and the wheel (1000) in SGR coordinates (1006), which reach past
 * column 223. Not motion (1002/1003): nothing here needs it, and it floods stdin.
 *
 * While this is on, the terminal's own drag-to-select needs a modifier held (Shift in most
 * terminals, Option in macOS ones), since the drag is reported to the app instead.
 */
export const MOUSE_ON = '\u001B[?1000h\u001B[?1006h';
export const MOUSE_OFF = '\u001B[?1006l\u001B[?1000l';

/** `ESC [ < button ; column ; row M` (pressed) or `m` (released); column and row from 1. */
const REPORT = /\u001B\[<(\d+);(\d+);(\d+)([Mm])/g;
/**
 * A report cut short by the end of a chunk. Only a sequence already known to be one is held
 * back: a lone ESC is far more often the Escape key, and an Escape held back never lands.
 */
const PARTIAL = /\u001B\[<[\d;]*$/;

const SHIFT = 4;
const META = 8;
const CTRL = 16;
const MOTION = 32;
const WHEEL = 64;
const EXTRA_BUTTONS = 128;
const BUTTONS: readonly (MouseButton | undefined)[] = ['left', 'middle', 'right'];
const WHEELS: readonly WheelDirection[] = ['up', 'down', 'left', 'right'];

function decode(code: number, column: number, row: number, final: string): MouseEvent | null {
  // Motion is reported only in modes this doesn't turn on; buttons 8–11 have no meaning here.
  if (code & (MOTION | EXTRA_BUTTONS)) return null;
  const base = {
    column: column - 1,
    row: row - 1,
    shift: (code & SHIFT) !== 0,
    meta: (code & META) !== 0,
    ctrl: (code & CTRL) !== 0,
  };
  if (code & WHEEL) {
    // Some terminals also report a wheel step's "release".
    return final === 'M' ? { ...base, type: 'wheel', direction: WHEELS[code & 3]! } : null;
  }
  const button = BUTTONS[code & 3];
  if (!button) return null;
  return { ...base, type: final === 'M' ? 'down' : 'up', button };
}

export interface MouseScan {
  events: MouseEvent[];
  /** Everything that wasn't a mouse report: the keyboard's input, in order. */
  keys: string;
  /** A report cut in half at the end of the chunk, to be read with the next one. */
  pending: string;
}

/** Splits a chunk of stdin into mouse events and the keyboard's input. */
export function scanMouse(chunk: string): MouseScan {
  const events: MouseEvent[] = [];
  let keys = '';
  let last = 0;
  for (const match of chunk.matchAll(REPORT)) {
    keys += chunk.slice(last, match.index);
    last = match.index + match[0].length;
    const event = decode(Number(match[1]), Number(match[2]), Number(match[3]), match[4]!);
    if (event) events.push(event);
  }
  const rest = chunk.slice(last);
  const partial = PARTIAL.exec(rest);
  if (!partial) return { events, keys: keys + rest, pending: '' };
  return { events, keys: keys + rest.slice(0, partial.index), pending: partial[0] };
}

export interface MouseInput {
  /** stdin without the mouse reports: what Ink reads its keys from. */
  stdin: NodeJS.ReadStream;
  subscribe(listener: (event: MouseEvent) => void): () => void;
  /** Turns reporting off and lets go of stdin. Safe to call more than once. */
  stop(): void;
}

/**
 * Turns mouse reporting on and splits `source` in two: mouse events go to subscribers, and the
 * rest goes to the returned `stdin` for Ink. Ink reads stdin in pull mode and drives a TTY's
 * controls on it, so that stream is a pass-through wearing the real one's raw mode and refcount.
 */
export function createMouseInput(
  source: NodeJS.ReadStream,
  stdout: NodeJS.WriteStream,
): MouseInput {
  const keys = new PassThrough();
  const listeners = new Set<(event: MouseEvent) => void>();
  let pending = '';

  const onData = (chunk: Buffer | string) => {
    const scan = scanMouse(pending + String(chunk));
    pending = scan.pending;
    if (scan.keys) keys.write(scan.keys);
    for (const event of scan.events) {
      for (const listener of listeners) listener(event);
    }
  };
  source.setEncoding('utf8');
  source.on('data', onData);
  stdout.write(MOUSE_ON);

  const stdin = Object.assign(keys, {
    isTTY: source.isTTY,
    setRawMode(mode: boolean) {
      source.setRawMode(mode);
      return stdin;
    },
    ref() {
      source.ref();
      return stdin;
    },
    unref() {
      source.unref();
      return stdin;
    },
  }) as unknown as NodeJS.ReadStream;

  let stopped = false;
  return {
    stdin,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    stop() {
      if (stopped) return;
      stopped = true;
      listeners.clear();
      source.off('data', onData);
      // Removing the listener doesn't stop a flowing stream from reading.
      source.pause();
      // A terminal reports until it is told not to, and a shell prints the reports it gets.
      try {
        stdout.write(MOUSE_OFF);
      } catch {
        // stdout may already be closed while the process exits.
      }
    },
  };
}

/** What an app root gets: the events, and how the app is placed in the window. */
export interface MouseSource {
  subscribe(listener: (event: MouseEvent) => void): () => void;
  /** True when Ink draws from the top of the window (its alternate screen). */
  fromTop: boolean;
  stop(): void;
}

const sources = new Map<number, MouseSource>();

/** Set by `render` before the app mounts, for the app root with this root tag. */
export function setMouseSource(rootTag: number, source: MouseSource | undefined): void {
  if (source) sources.set(rootTag, source);
  else sources.delete(rootTag);
}

export function mouseSourceFor(rootTag: number): MouseSource | undefined {
  return sources.get(rootTag);
}
