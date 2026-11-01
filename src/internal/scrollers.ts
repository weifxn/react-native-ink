import { createContext } from 'react';
import type { DOMElement } from 'ink';

export type ScrollAction = 'up' | 'down' | 'pageUp' | 'pageDown' | 'home' | 'end';

export interface Scroller {
  /** 0 for a ScrollView that isn't inside another one. */
  depth: number;
  horizontal: boolean;
  /** The ScrollView's host node, so the wheel can find the one under the pointer. */
  node(): DOMElement | null | undefined;
  /** False while the ScrollView can't scroll (no overflow, scrolling disabled, behind a modal). */
  canScroll(): boolean;
  scroll(action: ScrollAction): void;
  /** A step of the mouse wheel, back (-1) or forward (1). False if it can't move that way. */
  wheel(direction: 1 | -1): boolean;
}

const scrollers: Scroller[] = [];

/**
 * ScrollViews register here, in mount order: the vertical ones so the page can scroll with
 * nothing focused, and all of them for the wheel.
 */
export function registerScroller(scroller: Scroller): () => void {
  scrollers.push(scroller);
  return () => {
    const index = scrollers.indexOf(scroller);
    if (index !== -1) scrollers.splice(index, 1);
  };
}

/**
 * The page's scroller, like a browser's document: the outermost vertical ScrollView that can
 * scroll, earliest mounted first. Arrow and page keys go to it while nothing is focused.
 */
export function pageScroller(): Scroller | undefined {
  let best: Scroller | undefined;
  for (const scroller of scrollers) {
    if (scroller.horizontal || !scroller.canScroll()) continue;
    if (!best || scroller.depth < best.depth) best = scroller;
  }
  return best;
}

/** The ScrollView whose host node is `node`, if it is one. */
export function scrollerOf(node: DOMElement): Scroller | undefined {
  return scrollers.find((scroller) => scroller.node() === node);
}

/** How many ScrollViews enclose this point. */
export const ScrollDepthContext = createContext(0);
ScrollDepthContext.displayName = 'ScrollDepthContext';
