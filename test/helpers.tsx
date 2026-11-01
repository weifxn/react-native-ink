import { EventEmitter } from 'node:events';
import chalk from 'chalk';
import type { ReactElement } from 'react';
import { render as inkTestRender } from 'ink-testing-library';
import { AppRoot } from '../src/internal/AppRoot.js';
import { renderToString } from '../src/render.js';

/** Renders synchronously to a plain string (no colors). */
export const renderText = (element: ReactElement, columns = 40): string =>
  renderToString(element, { columns });

/** Renders with truecolor output enabled. */
export function renderColored(element: ReactElement, columns = 40): string {
  const previous = chalk.level;
  chalk.level = 3;
  try {
    return renderToString(element, { columns });
  } finally {
    chalk.level = previous;
  }
}

export const lines = (...rows: string[]): string => rows.join('\n');

/** Interactive render (real Ink instance with fake stdin/stdout) wrapped in the app root. */
export function renderInteractive(element: ReactElement) {
  return inkTestRender(<AppRoot>{element}</AppRoot>);
}

export const tick = (ms = 60) => new Promise((resolve) => setTimeout(resolve, ms));

/** Retries an assertion until it passes (or `timeout` ms elapse), for checks that follow input. */
export async function waitFor(assertion: () => void, { timeout = 2000, interval = 20 } = {}) {
  const start = Date.now();
  for (;;) {
    try {
      assertion();
      return;
    } catch (error) {
      if (Date.now() - start > timeout) throw error;
      await tick(interval);
    }
  }
}

/** Terminal input sequences. */
export const keys = {
  tab: '\t',
  shiftTab: '\u001B[Z',
  enter: '\r',
  escape: '\u001B',
  space: ' ',
  up: '\u001B[A',
  down: '\u001B[B',
  right: '\u001B[C',
  left: '\u001B[D',
  home: '\u001B[H',
  end: '\u001B[F',
  pageUp: '\u001B[5~',
  pageDown: '\u001B[6~',
  backspace: '\u007F',
  delete: '\u001B[3~',
  ctrlA: '\u0001',
  ctrlE: '\u0005',
  ctrlK: '\u000B',
  ctrlU: '\u0015',
  ctrlW: '\u0017',
} as const;

/** Writes input and waits for Ink to process it (Esc needs extra time to disambiguate). */
export async function press(stdin: { write(data: string): void }, ...sequence: string[]) {
  for (const data of sequence) {
    stdin.write(data);
    await tick(data === keys.escape ? 150 : 50);
  }
}

/** Minimal TTY-like output stream for running real Ink instances in tests. */
export class FakeStdout extends EventEmitter {
  columns = 40;
  rows = 12;
  isTTY = true;
  frames: string[] = [];
  write = (data: string, encodingOrCallback?: unknown, callback?: unknown) => {
    this.frames.push(data);
    const done = typeof encodingOrCallback === 'function' ? encodingOrCallback : callback;
    if (typeof done === 'function') queueMicrotask(() => (done as () => void)());
    return true;
  };
  get lastFrame(): string {
    return this.frames[this.frames.length - 1] ?? '';
  }
}

/** Minimal TTY-like input stream. */
export class FakeStdin extends EventEmitter {
  isTTY = true;
  setEncoding() {}
  setRawMode() {}
  resume() {}
  pause() {}
  ref() {}
  unref() {}
  read() {
    return null;
  }
}
