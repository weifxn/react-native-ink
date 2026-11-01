import { useLayoutEffect, useRef, type RefObject } from 'react';
import type { DOMElement } from 'ink';
import { fromCells, getCellSize } from './units.js';

/**
 * Clicks and the wheel (see mouse.ts for where they come from). A click goes to the component
 * drawn where it landed — found the way Ink paints, so the one on top wins — or to the nearest
 * component around it that takes clicks; the wheel scrolls the ScrollView under the pointer.
 */

/** Where a press is, in layout units: in the window, and within the component. */
export interface PointerLocation {
  pageX: number;
  pageY: number;
  locationX: number;
  locationY: number;
  /** Within the component, in cells. */
  cellX: number;
  cellY: number;
}

/** A component that takes clicks. */
export interface PointerTarget {
  /** The button went down over it. */
  pressIn(location: PointerLocation): void;
  /** The button came up. `activate` when it came up over the component (and not after a long press). */
  pressOut(location: PointerLocation, activate: boolean): void;
  /** Called once the button has been held `longPressDelay` ms, if given. */
  longPress?: (location: PointerLocation) => void;
  longPressDelay?: number;
}

/** The current target, or null while the component doesn't take clicks (e.g. disabled). */
type TargetSource = () => PointerTarget | null;

const targets = new WeakMap<DOMElement, TargetSource>();

/**
 * Makes the host node in `nodeRef` take clicks. `target` is read when a click arrives, so it can
 * be a new object every render; null (e.g. while disabled) lets clicks through to the component
 * around it.
 */
export function usePointerTarget(
  nodeRef: RefObject<DOMElement | null>,
  target: PointerTarget | null,
): void {
  const latest = useRef(target);
  latest.current = target;
  const source = useRef<TargetSource | null>(null);
  source.current ??= () => latest.current;
  const registered = useRef<DOMElement | null>(null);
  // Every commit: the host node changes if the View under it remounts.
  useLayoutEffect(() => {
    const node = nodeRef.current;
    if (node === registered.current) return;
    const own = source.current!;
    if (registered.current && targets.get(registered.current) === own) {
      targets.delete(registered.current);
    }
    registered.current = node;
    if (node) targets.set(node, own);
  });
  useLayoutEffect(
    () => () => {
      const node = registered.current;
      if (node && targets.get(node) === source.current) targets.delete(node);
      registered.current = null;
    },
    [],
  );
}

/** The nearest node from `node` up that takes clicks right now, with its target. */
export function targetAt(
  node: DOMElement | undefined,
): { node: DOMElement; target: PointerTarget } | undefined {
  for (let current = node; current; current = current.parentNode) {
    const target = targets.get(current)?.();
    if (target) return { node: current, target };
  }
  return undefined;
}

// Yoga's Display.None and Edge values, as Ink uses them (yoga-layout is Ink's dependency).
const DISPLAY_NONE = 1;
const EDGE_LEFT = 0;
const EDGE_TOP = 1;
const EDGE_RIGHT = 2;
const EDGE_BOTTOM = 3;

interface Clip {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

const UNCLIPPED: Clip = { x1: -Infinity, x2: Infinity, y1: -Infinity, y2: Infinity };

// Ink truncates content offsets to whole cells, and treats anything else as 0.
const contentOffset = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : 0;

function hit(
  node: DOMElement,
  offsetX: number,
  offsetY: number,
  clip: Clip,
  column: number,
  row: number,
): DOMElement | undefined {
  const yoga = node.yogaNode;
  if (!yoga || yoga.getDisplay() === DISPLAY_NONE) return undefined;
  const x = offsetX + yoga.getComputedLeft();
  const y = offsetY + yoga.getComputedTop();
  const width = yoga.getComputedWidth();
  const height = yoga.getComputedHeight();
  const here =
    column >= Math.max(x, clip.x1) &&
    column < Math.min(x + width, clip.x2) &&
    row >= Math.max(y, clip.y1) &&
    row < Math.min(y + height, clip.y2);
  if (node.nodeName === 'ink-text') return here ? node : undefined;
  if (node.nodeName !== 'ink-box' && node.nodeName !== 'ink-root') return undefined;

  // As Ink paints: an overflow: hidden box clips what's inside it (inside its border), nested
  // clips intersect, and content is shifted by the box's content offset (a ScrollView's).
  let inner = clip;
  const overflowX = node.style.overflowX ?? node.style.overflow;
  const overflowY = node.style.overflowY ?? node.style.overflow;
  if (overflowX === 'hidden') {
    inner = {
      ...inner,
      x1: Math.max(inner.x1, x + yoga.getComputedBorder(EDGE_LEFT)),
      x2: Math.min(inner.x2, x + width - yoga.getComputedBorder(EDGE_RIGHT)),
    };
  }
  if (overflowY === 'hidden') {
    inner = {
      ...inner,
      y1: Math.max(inner.y1, y + yoga.getComputedBorder(EDGE_TOP)),
      y2: Math.min(inner.y2, y + height - yoga.getComputedBorder(EDGE_BOTTOM)),
    };
  }
  const childX = x - contentOffset(node.style.contentOffsetX);
  const childY = y - contentOffset(node.style.contentOffsetY);
  // Later children paint over earlier ones, so the last one under the point is on top.
  for (let index = node.childNodes.length - 1; index >= 0; index--) {
    const child = node.childNodes[index]!;
    if (child.nodeName !== 'ink-box' && child.nodeName !== 'ink-text') continue;
    const found = hit(child, childX, childY, inner, column, row);
    if (found) return found;
  }
  return here ? node : undefined;
}

/**
 * The node drawn on top at (column, row) of the layout (0-based, from the root's top left),
 * as Ink paints it: hidden subtrees skipped, clipping and scroll offsets applied.
 */
export function hitTest(root: DOMElement, column: number, row: number): DOMElement | undefined {
  return hit(root, 0, 0, UNCLIPPED, column, row);
}

/** Where `node` is drawn, in cells from the layout's top left (scroll offsets applied). */
export function positionOf(node: DOMElement): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (let current: DOMElement | undefined = node; current; current = current.parentNode) {
    x += current.yogaNode?.getComputedLeft() ?? 0;
    y += current.yogaNode?.getComputedTop() ?? 0;
    const parent = current.parentNode;
    if (parent) {
      x -= contentOffset(parent.style.contentOffsetX);
      y -= contentOffset(parent.style.contentOffsetY);
    }
  }
  return { x, y };
}

/** A press at (column, row) of the layout, relative to `node`, in layout units. */
export function locationIn(node: DOMElement, column: number, row: number): PointerLocation {
  const cell = getCellSize();
  const at = positionOf(node);
  return {
    pageX: fromCells(column, cell, 'x'),
    pageY: fromCells(row, cell, 'y'),
    locationX: fromCells(column - at.x, cell, 'x'),
    locationY: fromCells(row - at.y, cell, 'y'),
    cellX: column - at.x,
    cellY: row - at.y,
  };
}

/** True when `node` is `ancestor` or inside it. */
export function isWithin(node: DOMElement | undefined, ancestor: DOMElement): boolean {
  for (let current = node; current; current = current.parentNode) {
    if (current === ancestor) return true;
  }
  return false;
}
