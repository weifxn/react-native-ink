import { useContext, useImperativeHandle, useMemo, useRef, type ReactNode, type Ref } from 'react';
import { Box, type DOMElement } from 'ink';
import { resolveAccessibility, type AccessibilityProps } from '../../internal/accessibility.js';
import { TextInheritanceContext } from '../../internal/contexts.js';
import type { LayoutChangeEvent } from '../../internal/events.js';
import { LayoutObserver } from '../../internal/LayoutObserver.js';
import { attachNativeMethods, type HostInstance } from '../../internal/nativeMethods.js';
import { warnOnce } from '../../internal/warn.js';
import { flattenStyle } from '../../style/flatten.js';
import type { StyleProp, ViewStyle } from '../../style/types.js';
import { resolveViewStyle, type InkBoxProps } from '../../style/view.js';

export interface Insets {
  top?: number;
  left?: number;
  bottom?: number;
  right?: number;
}

export interface ViewProps extends AccessibilityProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Called with `{nativeEvent: {layout: {x, y, width, height}}}` whenever the layout changes. */
  onLayout?: (event: LayoutChangeEvent) => void;
  testID?: string;
  nativeID?: string;
  id?: string;
  /** @remarks Ignored in terminals. */
  pointerEvents?: 'box-none' | 'none' | 'box-only' | 'auto';
  /** @remarks Ignored in terminals. */
  hitSlop?: Insets | number | null;
  /** @remarks Ignored in terminals. */
  collapsable?: boolean;
  /** @remarks Ignored in terminals. */
  collapsableChildren?: boolean;
  /** @remarks Ignored in terminals. */
  removeClippedSubviews?: boolean;
  /** @remarks Ignored in terminals. */
  needsOffscreenAlphaCompositing?: boolean;
  /** @remarks Ignored in terminals. */
  renderToHardwareTextureAndroid?: boolean;
  /** @remarks Ignored in terminals. */
  shouldRasterizeIOS?: boolean;
  /** @remarks Ignored in terminals. */
  focusable?: boolean;
  /** @remarks Ignored in terminals. */
  tabIndex?: 0 | -1;
  ref?: Ref<HostInstance | null>;
}

/** Internal: render a View with precomputed Ink box props (used by composite components). */
export interface ViewInternalProps extends ViewProps {
  boxRef?: Ref<DOMElement>;
  /** Extra box props merged over the resolved style. */
  overrideBox?: InkBoxProps;
  /** Extra text inheritance for descendants (e.g. focus inverse). */
  inverseText?: boolean;
  dimText?: boolean;
  component?: string;
}

function mergeRefs<T>(...refs: Array<Ref<T> | undefined>) {
  return (value: T | null) => {
    for (const ref of refs) {
      if (typeof ref === 'function') ref(value);
      else if (ref) (ref as { current: T | null }).current = value;
    }
  };
}

/** The basic layout container: an Ink `<Box>` with React Native's style semantics. */
export function View(props: ViewProps & Partial<ViewInternalProps>) {
  const {
    style,
    children,
    onLayout,
    ref,
    boxRef: externalBoxRef,
    overrideBox,
    inverseText,
    dimText,
  } = props;
  const component = props.component ?? 'View';
  const inherited = useContext(TextInheritanceContext);
  const boxRef = useRef<DOMElement>(null);

  useImperativeHandle(
    ref,
    () =>
      boxRef.current ? attachNativeMethods(boxRef.current) : (null as unknown as HostInstance),
    [],
  );

  const resolved = resolveViewStyle(flattenStyle(style), { component });
  const dim = inherited.dim || resolved.dim || Boolean(dimText);
  const hidden = inherited.hidden || resolved.hidden;
  const inverse = inherited.inverse || Boolean(inverseText);
  const inheritance = useMemo(
    () => ({ inText: false, transform: undefined, dim, hidden, inverse }),
    [dim, hidden, inverse],
  );

  if (inherited.inText) {
    warnOnce(
      'View:inText',
      'A <View> inside <Text> is not supported in terminals; its children were rendered inline.',
    );
    return <>{children}</>;
  }

  const box = { ...resolved.box, ...resolveAccessibility(props), ...overrideBox };
  const needsContext =
    dim !== inherited.dim || hidden !== inherited.hidden || inverse !== inherited.inverse;
  const content = (
    <Box ref={mergeRefs(boxRef, externalBoxRef)} {...box}>
      {children}
      {onLayout ? <LayoutObserver target={boxRef} onLayout={onLayout} /> : null}
    </Box>
  );
  return needsContext ? (
    <TextInheritanceContext.Provider value={inheritance}>{content}</TextInheritanceContext.Provider>
  ) : (
    content
  );
}
