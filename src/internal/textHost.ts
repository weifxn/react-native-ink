import { createElement, type ReactNode, type RefObject } from 'react';
import type { DOMElement } from 'ink';
import stringWidth from 'string-width';
import wrapAnsi from 'wrap-ansi';
import { paintBackground } from '../style/colors.js';

/** Ink text wrap modes. */
export type TextWrap =
  'wrap' | 'hard' | 'truncate-end' | 'truncate' | 'truncate-middle' | 'truncate-start';
export type LineTransform = (line: string, index: number) => string;

/**
 * Renders Ink's `ink-text` host element directly (as Ink's own `<Transform>` does) so a text
 * block can have both a wrap mode and a per-line transform applied after wrapping.
 */
export function textHost(
  wrap: TextWrap,
  transform: LineTransform | undefined,
  children: ReactNode,
  ref?: RefObject<DOMElement | null>,
) {
  return createElement(
    'ink-text' as never,
    {
      ref,
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

/**
 * Replaces a line with spaces of the same width (opacity 0 / transparent text), painted with
 * `background` so the text's space doesn't show the terminal's own background.
 */
export const blankLine = (line: string, _index = 0, background?: string): string =>
  paintBackground(' '.repeat(stringWidth(stripAnsi(line))), background);

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

/** Pads a line so it is centered or right-aligned within `width` cells (padding painted with `background`). */
export function alignLine(
  line: string,
  width: number | undefined,
  align: 'center' | 'right',
  background?: string,
): string {
  if (width === undefined) return line;
  const free = Math.floor(width) - visibleWidth(line);
  if (free <= 0) return line;
  return (
    paintBackground(' '.repeat(align === 'center' ? Math.floor(free / 2) : free), background) + line
  );
}

/** The (styled) text Ink wraps for an ink-text node, built as Ink's own squashTextNodes does. */
function squash(node: DOMElement): string {
  let text = '';
  for (const child of node.childNodes) {
    if (child.nodeName === '#text') {
      text += child.nodeValue;
      continue;
    }
    if (child.isHidden) continue;
    let part =
      child.nodeName === 'ink-text' || child.nodeName === 'ink-virtual-text' ? squash(child) : '';
    const transform = child.internal_transform;
    if (part.length > 0 && typeof transform === 'function') {
      part = part
        .split('\n')
        .map((line, index) => transform(line, index))
        .join('\n');
    }
    text += part;
  }
  text = text.replaceAll('\r\n', '\n');
  return text.includes('\t') ? wrapAnsi(text, Infinity, { trim: false }) : text;
}

interface Rows {
  /** Each row's text, unstyled, and whether it carries on a paragraph from the row before. */
  rows: string[];
  continues: boolean[];
}

/** Recently wrapped texts, by mode, width and text, as Ink keeps its own. */
const wrapCache = new Map<string, Rows>();
const WRAP_CACHE_SIZE = 1024;

/** The rows Ink wraps an ink-text node's text into at `width`, or undefined when it doesn't. */
function rowsOf(node: DOMElement, width: number): Rows | undefined {
  const styled = squash(node);
  const widest = Math.max(0, ...styled.split('\n').map((line) => stringWidth(line)));
  // As Ink: text that fits isn't wrapped, nor is text with no room at all.
  if (widest <= width || width <= 0) return undefined;
  const columns = Math.max(1, width);
  const hard = node.style.textWrap === 'hard';
  const plain = stripAnsi(styled);
  const key = `${hard ? 'h' : 'w'}${columns}\u0000${plain}`;
  const cached = wrapCache.get(key);
  if (cached) return cached;
  const options = hard ? { trim: false, hard: true, wordWrap: false } : { trim: false, hard: true };
  const result: Rows = { rows: [], continues: [] };
  // wrap-ansi wraps each paragraph on its own, so this gives Ink's rows, unstyled.
  for (const paragraph of plain.split('\n')) {
    wrapAnsi(paragraph, columns, options)
      .split('\n')
      .forEach((row, index) => {
        result.rows.push(row);
        result.continues.push(index > 0);
      });
  }
  if (wrapCache.size >= WRAP_CACHE_SIZE) wrapCache.delete(wrapCache.keys().next().value!);
  wrapCache.set(key, result);
  return result;
}

// Style codes (and links) at the start of a line, then a space.
const LEADING_SPACE =
  /^((?:\u001B\[[0-?]*[ -/]*[@-~]|\u001B\][^\u0007\u001B]*(?:\u0007|\u001B\\))*) /;

/**
 * A line transform for the ink-text in `nodeRef` that drops the space a wrapped line broke at.
 * Ink keeps every space when it wraps (so indentation survives), which leaves the break's
 * space at the start of the next row whenever the row before was exactly full; React Native
 * starts a wrapped row at its next word. A paragraph's own first row keeps its leading spaces,
 * and a line that isn't the row expected (a clipped one) is left as it is.
 */
export function dropBreakSpaces(nodeRef: RefObject<DOMElement | null>): LineTransform {
  // Ink calls this for every line of every frame. The text is the one this render produced
  // (a new transform comes with each render), so it's read once per width: if a nested Text
  // changed it since, rows stop matching and lines pass through untouched.
  let known: { width: number; rows: Rows | undefined } | undefined;
  return (line, index) => {
    const node = nodeRef.current;
    if (!node) return line;
    const width = innerWidth(node) ?? 0;
    if (known?.width !== width) known = { width, rows: rowsOf(node, width) };
    const { rows } = known;
    if (!rows?.continues[index] || stripAnsi(line) !== rows.rows[index]) return line;
    return line.replace(LEADING_SPACE, '$1');
  };
}
