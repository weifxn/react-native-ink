import { createElement, type ReactNode } from 'react';
import type { DOMElement } from 'ink';
import stringWidth from 'string-width';

/** Ink text wrap modes. */
export type TextWrap = 'wrap' | 'hard' | 'truncate-end' | 'truncate' | 'truncate-middle' | 'truncate-start';
export type LineTransform = (line: string, index: number) => string;

/**
 * Renders Ink's `ink-text` host element directly (as Ink's own `<Transform>` does) so a text
 * block can have both a wrap mode and a per-line transform applied after wrapping.
 */
export function textHost(wrap: TextWrap, transform: LineTransform | undefined, children: ReactNode) {
  return createElement(
    'ink-text' as never,
    {
      style: { flexGrow: 0, flexShrink: 1, flexDirection: 'row', textWrap: wrap },
      internal_transform: transform,
    } as never,
    children,
  );
}

const ANSI = /\u001B\[[0-?]*[ -/]*[@-~]|\u001B\][^\u0007\u001B]*(?:\u0007|\u001B\\)/g;

export const stripAnsi = (text: string): string => text.replace(ANSI, '');

/** Visible width of a (possibly styled) line, ignoring trailing whitespace. */
export const visibleWidth = (line: string): number => stringWidth(stripAnsi(line).trimEnd());

/** Replaces a line with spaces of the same width (opacity 0 / transparent text). */
export const blankLine: LineTransform = (line) => ' '.repeat(stringWidth(stripAnsi(line)));

// Yoga edges.
const LEFT = 0;
const RIGHT = 2;

/** Inner width (minus padding and border) of a laid-out Ink box. */
export function innerWidth(node: DOMElement | null | undefined): number | undefined {
  const yoga = node?.yogaNode;
  if (!yoga) return undefined;
  return (
    yoga.getComputedWidth() -
    yoga.getComputedPadding(LEFT) -
    yoga.getComputedPadding(RIGHT) -
    yoga.getComputedBorder(LEFT) -
    yoga.getComputedBorder(RIGHT)
  );
}

/** Pads a line so it is centered or right-aligned within `width` cells. */
export function alignLine(line: string, width: number | undefined, align: 'center' | 'right'): string {
  if (width === undefined) return line;
  const free = Math.floor(width) - visibleWidth(line);
  if (free <= 0) return line;
  return ' '.repeat(align === 'center' ? Math.floor(free / 2) : free) + line;
}
