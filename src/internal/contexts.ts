import { createContext } from 'react';
import type { DOMElement } from 'ink';
import type { TextTransform } from '../style/text.js';

/** What a `<Text>` passes down to nested text and what a `<View>` passes down to all text. */
export interface TextInheritance {
  /** True inside a `<Text>`: nested text renders inline. */
  inText: boolean;
  transform?: TextTransform;
  /** opacity < 1 on an ancestor, light font weight, ... */
  dim: boolean;
  /** opacity 0 on an ancestor: keep the space, draw nothing. */
  hidden: boolean;
  /** Default focus indicator of pressables: draw text in inverse video. */
  inverse: boolean;
}

export const TextInheritanceContext = createContext<TextInheritance>({
  inText: false,
  dim: false,
  hidden: false,
  inverse: false,
});
TextInheritanceContext.displayName = 'TextInheritanceContext';

/** React Native's `unstable_TextAncestorContext`: true inside a `<Text>`. */
export const TextAncestorContext = createContext(false);
TextAncestorContext.displayName = 'TextAncestorContext';

/** False while a modal covers this part of the tree: focusables here are skipped. */
export const FocusScopeContext = createContext(true);
FocusScopeContext.displayName = 'FocusScopeContext';

export interface ScrollIntoView {
  /**
   * Scrolls so `node` is visible — or only `rect` of it (cells, relative to its top-left), which
   * is how a nested ScrollView passes on the part of its viewport the target now occupies.
   * Enclosing ScrollViews are asked in turn, so a focused item inside a pager inside a page
   * comes into view on both axes.
   */
  scrollIntoView(
    node: DOMElement,
    rect?: { x: number; y: number; width: number; height: number },
  ): void;
}

/** Provided by ScrollView so focused descendants can be scrolled into view. */
export const ScrollIntoViewContext = createContext<ScrollIntoView | null>(null);
ScrollIntoViewContext.displayName = 'ScrollIntoViewContext';

/** React Native's `RootTagContext`. */
export const RootTagContext = createContext<number>(0);
RootTagContext.displayName = 'RootTagContext';

/**
 * The background color behind this point: the nearest View's own (resolved) backgroundColor.
 * Ink paints a box's background inside its border only, and leaves cells the library writes
 * itself (border glyphs, alignment padding) without one, which would show the terminal's own
 * background through them; React Native paints a view's background under its border too.
 */
export const BackgroundColorContext = createContext<string | undefined>(undefined);
BackgroundColorContext.displayName = 'BackgroundColorContext';
