import { createContext } from 'react';

export type ScrollAction = 'up' | 'down' | 'pageUp' | 'pageDown' | 'home' | 'end';

export interface Scroller {
  /** 0 for a ScrollView that isn't inside another one. */
  depth: number;
  /** False while the ScrollView can't scroll (no overflow, scrolling disabled, behind a modal). */
  canScroll(): boolean;
  scroll(action: ScrollAction): void;
}

const scrollers: Scroller[] = [];

/** Vertical ScrollViews register here, in mount order, so the page can scroll with nothing focused. */
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
    if (!scroller.canScroll()) continue;
    if (!best || scroller.depth < best.depth) best = scroller;
  }
  return best;
}

/** How many ScrollViews enclose this point. */
export const ScrollDepthContext = createContext(0);
ScrollDepthContext.displayName = 'ScrollDepthContext';
