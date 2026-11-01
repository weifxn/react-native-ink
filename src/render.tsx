import type { ReactNode } from 'react';
import {
  render as inkRender,
  renderToString as inkRenderToString,
  type Instance,
  type RenderOptions as InkRenderOptions,
  type RenderToStringOptions,
} from 'ink';
import { AppRoot } from './internal/AppRoot.js';
import { createMouseInput, setMouseSource } from './internal/mouse.js';

let nextRootTag = 1;

/** Allocates a root tag for a new app instance. */
export const allocateRootTag = (): number => nextRootTag++;

const isTerminalInput = (stream: NodeJS.ReadableStream): stream is NodeJS.ReadStream =>
  'isTTY' in stream && stream.isTTY === true && 'setRawMode' in stream;
const isTerminalOutput = (stream: NodeJS.WritableStream): stream is NodeJS.WriteStream =>
  'isTTY' in stream && stream.isTTY === true;

/** Ink's render options, plus the mouse. */
export interface RenderOptions extends InkRenderOptions {
  /**
   * Take clicks and the wheel: a click presses what it lands on (Pressable, Button, Switch,
   * pressable Text) or focuses a TextInput, and the wheel scrolls the ScrollView under the
   * pointer. Needs a terminal on both stdin and stdout, and an app drawn from the top of the
   * window: `alternateScreen: true`, or one as tall as the window. While it's on, selecting text
   * in the terminal needs a modifier held (Shift in most terminals, Option in macOS ones).
   */
  mouse?: boolean;
}

/**
 * Renders a React element in the terminal (like Ink's `render`), wrapped in the app root that
 * powers Modal, Alert, BackHandler, Keyboard and Dimensions. Returns Ink's instance.
 */
export function render(
  node: ReactNode,
  options?: RenderOptions | NodeJS.WriteStream,
  rootTag: number = allocateRootTag(),
): Instance {
  const settings: RenderOptions =
    options && 'write' in options ? { stdout: options } : { ...options };
  const { mouse, ...inkOptions } = settings;
  const stdin = inkOptions.stdin ?? process.stdin;
  const stdout = inkOptions.stdout ?? process.stdout;
  const input =
    mouse && isTerminalInput(stdin) && isTerminalOutput(stdout) && inkOptions.interactive !== false
      ? createMouseInput(stdin, stdout)
      : undefined;
  if (!input) return inkRender(<AppRoot rootTag={rootTag}>{node}</AppRoot>, inkOptions);

  // However the app ends — unmounted (which a signal also does, through Ink) or the process
  // exiting — the terminal has to be told to stop reporting, or the shell prints the reports.
  const stop = () => {
    process.off('exit', stop);
    setMouseSource(rootTag, undefined);
    input.stop();
  };
  process.once('exit', stop);
  setMouseSource(rootTag, {
    subscribe: input.subscribe,
    fromTop: Boolean(inkOptions.alternateScreen),
    stop,
  });
  const instance = inkRender(<AppRoot rootTag={rootTag}>{node}</AppRoot>, {
    ...inkOptions,
    stdin: input.stdin,
  });
  instance.waitUntilExit().then(stop, stop);
  return instance;
}

/** Renders a React element to a string synchronously (no terminal needed). */
export function renderToString(node: ReactNode, options?: RenderToStringOptions): string {
  return inkRenderToString(<AppRoot>{node}</AppRoot>, options);
}

export type { Instance, RenderToStringOptions };
