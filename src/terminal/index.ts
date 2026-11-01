/**
 * Terminal APIs re-exported from Ink, so apps never need to import `ink` directly and always
 * share a single Ink instance with this library.
 */
export {
  useInput,
  usePaste,
  useApp,
  useStdin,
  useStdout,
  useStderr,
  useFocus,
  useFocusManager,
  useIsScreenReaderEnabled,
  useCursor,
  useAnimation,
  useWindowSize,
  useBoxMetrics,
  measureElement,
  Static,
  Transform,
  Newline,
  Spacer,
  kittyFlags,
  kittyModifiers,
} from 'ink';
export type {
  Key,
  DOMElement,
  BoxMetrics,
  UseBoxMetricsResult,
  WindowSize,
  ElementMetrics,
  AnimationResult,
  StaticProps,
  TransformProps,
  NewlineProps,
  KittyKeyboardOptions,
  KittyFlagName,
} from 'ink';
