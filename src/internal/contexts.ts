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
  scrollIntoView(node: DOMElement): void;
}

/** Provided by ScrollView so focused descendants can be scrolled into view. */
export const ScrollIntoViewContext = createContext<ScrollIntoView | null>(null);
ScrollIntoViewContext.displayName = 'ScrollIntoViewContext';

/** React Native's `RootTagContext`. */
export const RootTagContext = createContext<number>(0);
RootTagContext.displayName = 'RootTagContext';
