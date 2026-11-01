import type { DOMElement } from 'ink';
import { frameFromCells, getCellSize } from './units.js';
import { warnOnce } from './warn.js';

export type MeasureOnSuccessCallback = (
  x: number,
  y: number,
  width: number,
  height: number,
  pageX: number,
  pageY: number,
) => void;
export type MeasureInWindowOnSuccessCallback = (
  x: number,
  y: number,
  width: number,
  height: number,
) => void;
export type MeasureLayoutOnSuccessCallback = (
  left: number,
  top: number,
  width: number,
  height: number,
) => void;

/** React Native's host-instance methods. */
export interface NativeMethods {
  measure(callback: MeasureOnSuccessCallback): void;
  measureInWindow(callback: MeasureInWindowOnSuccessCallback): void;
  measureLayout(
    relativeToNativeNode: unknown,
    onSuccess: MeasureLayoutOnSuccessCallback,
    onFail?: () => void,
  ): void;
  focus(): void;
  blur(): void;
  setNativeProps(nativeProps: object): void;
}

/** View/Text refs are Ink DOM elements extended with React Native's measure methods. */
export type HostInstance = DOMElement & NativeMethods;

interface Frame {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The node's frame in layout units (cells times the cell size). */
const frameOf = (node: DOMElement): Frame | undefined => {
  const yoga = node.yogaNode;
  if (!yoga) return undefined;
  return frameFromCells(
    {
      x: yoga.getComputedLeft(),
      y: yoga.getComputedTop(),
      width: yoga.getComputedWidth(),
      height: yoga.getComputedHeight(),
    },
    getCellSize(),
  );
};

/** Position relative to the root of the Ink tree, in layout units. */
const pagePosition = (node: DOMElement): { x: number; y: number } => {
  const { x, y } = absolutePosition(node);
  const cell = getCellSize();
  return { x: x * cell.width, y: y * cell.height };
};

/** Position relative to the root of the Ink tree, in cells. */
export function absolutePosition(node: DOMElement): { x: number; y: number } {
  let x = 0;
  let y = 0;
  let current: DOMElement | undefined = node;
  while (current) {
    const yoga = current.yogaNode;
    if (yoga) {
      x += yoga.getComputedLeft();
      y += yoga.getComputedTop();
    }
    current = current.parentNode;
  }
  return { x, y };
}

export function attachNativeMethods(
  node: DOMElement,
  overrides: Partial<Pick<NativeMethods, 'focus' | 'blur'>> = {},
): HostInstance {
  const methods: NativeMethods = {
    measure(callback) {
      queueMicrotask(() => {
        const frame = frameOf(node);
        if (!frame) return;
        const page = pagePosition(node);
        callback(frame.x, frame.y, frame.width, frame.height, page.x, page.y);
      });
    },
    measureInWindow(callback) {
      queueMicrotask(() => {
        const frame = frameOf(node);
        if (!frame) return;
        const page = pagePosition(node);
        callback(page.x, page.y, frame.width, frame.height);
      });
    },
    measureLayout(relativeTo, onSuccess, onFail) {
      queueMicrotask(() => {
        const frame = frameOf(node);
        const other = relativeTo as DOMElement | null;
        if (!frame || !other || typeof other !== 'object' || !('yogaNode' in other)) {
          onFail?.();
          return;
        }
        const a = pagePosition(node);
        const b = pagePosition(other);
        onSuccess(a.x - b.x, a.y - b.y, frame.width, frame.height);
      });
    },
    focus: overrides.focus ?? (() => {}),
    blur: overrides.blur ?? (() => {}),
    setNativeProps() {
      warnOnce(
        'setNativeProps',
        'setNativeProps is not supported; update props through React state instead.',
      );
    },
  };
  return Object.assign(node, methods);
}
