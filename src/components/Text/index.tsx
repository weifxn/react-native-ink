import {
  Children,
  useContext,
  useImperativeHandle,
  useMemo,
  useRef,
  type ReactNode,
  type Ref,
} from 'react';
import { Box, Text as InkText, Transform, useInput, type DOMElement } from 'ink';
import { resolveAccessibility, type AccessibilityProps } from '../../internal/accessibility.js';
import { TextAncestorContext, TextInheritanceContext } from '../../internal/contexts.js';
import { createPressEvent, type GestureResponderEvent, type LayoutChangeEvent } from '../../internal/events.js';
import { useFocusable } from '../../internal/focus.js';
import { LayoutObserver } from '../../internal/LayoutObserver.js';
import { attachNativeMethods, type HostInstance } from '../../internal/nativeMethods.js';
import {
  alignLine,
  blankLine,
  innerWidth,
  textHost,
  type LineTransform,
  type TextWrap,
} from '../../internal/textHost.js';
import { flattenStyle } from '../../style/flatten.js';
import {
  applyTextTransform,
  resolveTextStyle,
  splitTextStyle,
  type TextTransform,
} from '../../style/text.js';
import type { StyleProp, TextStyle } from '../../style/types.js';
import { resolveViewStyle } from '../../style/view.js';

export interface TextProps extends AccessibilityProps {
  children?: ReactNode;
  style?: StyleProp<TextStyle>;
  /** Limits the text to this many lines. With 1, overflowing text is truncated with an ellipsis. */
  numberOfLines?: number;
  /** Where the ellipsis goes when `numberOfLines` is set. `clip` cuts without an ellipsis. */
  ellipsizeMode?: 'head' | 'middle' | 'tail' | 'clip';
  /** Makes the text focusable (Tab); Enter or Space presses it. */
  onPress?: (event: GestureResponderEvent) => void;
  onPressIn?: (event: GestureResponderEvent) => void;
  onPressOut?: (event: GestureResponderEvent) => void;
  /** @remarks Not triggered from the keyboard. */
  onLongPress?: (event: GestureResponderEvent) => void;
  disabled?: boolean;
  onLayout?: (event: LayoutChangeEvent) => void;
  testID?: string;
  nativeID?: string;
  id?: string;
  /** @remarks Ignored in terminals. */
  selectable?: boolean;
  /** @remarks Ignored in terminals. */
  selectionColor?: string;
  /** @remarks Ignored in terminals. */
  allowFontScaling?: boolean;
  /** @remarks Ignored in terminals. */
  adjustsFontSizeToFit?: boolean;
  /** @remarks Ignored in terminals. */
  maxFontSizeMultiplier?: number | null;
  /** @remarks Ignored in terminals. */
  minimumFontScale?: number;
  /** @remarks Ignored in terminals. */
  suppressHighlighting?: boolean;
  /** @remarks Ignored in terminals. */
  textBreakStrategy?: 'simple' | 'highQuality' | 'balanced';
  /** @remarks Ignored in terminals. */
  lineBreakStrategyIOS?: 'none' | 'standard' | 'hangul-word' | 'push-out';
  /** @remarks Ignored in terminals. */
  dataDetectorType?: string | null;
  ref?: Ref<HostInstance | null>;
}

interface TextImplProps extends TextProps {
  focusInverse?: boolean;
}

/** Text layout box defaults: a row so wrapping happens at the box width; shrinks like web text. */
const TEXT_BOX_DEFAULTS = { flexDirection: 'row', flexGrow: 0, flexShrink: 1 };

const ELLIPSIS_WRAP: Record<string, TextWrap> = {
  head: 'truncate-start',
  middle: 'truncate-middle',
  tail: 'truncate-end',
};

const transformChildren = (children: ReactNode, transform: TextTransform | undefined): ReactNode => {
  if (!transform || transform === 'none') return children;
  return Children.map(children, (child) =>
    typeof child === 'string' || typeof child === 'number'
      ? applyTextTransform(String(child), transform)
      : child,
  );
};

const numericSide = (value: unknown) => (typeof value === 'number' ? value : 0);

function TextImpl(props: TextImplProps) {
  const { style, children, numberOfLines, ellipsizeMode = 'tail', onLayout, ref, focusInverse } = props;
  const inherited = useContext(TextInheritanceContext);
  const boxRef = useRef<DOMElement>(null);
  useImperativeHandle(
    ref,
    () => (boxRef.current ? attachNativeMethods(boxRef.current) : (null as unknown as HostInstance)),
    [],
  );

  const nested = inherited.inText;
  const { text: textStyle, layout } = splitTextStyle(flattenStyle(style));
  const resolved = resolveTextStyle(textStyle);
  const transform = resolved.transform ?? inherited.transform;
  const dim = resolved.dim || (!nested && inherited.dim);
  const hidden = resolved.hidden || (!nested && inherited.hidden);
  const inverse = Boolean(focusInverse) || (!nested && inherited.inverse);

  const inheritance = useMemo(
    () => ({ inText: true, transform, dim: inherited.dim || dim, hidden: inherited.hidden || hidden, inverse }),
    [transform, inherited.dim, inherited.hidden, dim, hidden, inverse],
  );

  const lines = numberOfLines !== undefined && numberOfLines > 0 ? Math.floor(numberOfLines) : undefined;
  const clip = lines !== undefined && ellipsizeMode === 'clip';
  const wrap: TextWrap =
    lines === 1 && !clip ? (ELLIPSIS_WRAP[ellipsizeMode] ?? 'truncate-end') : clip ? 'hard' : 'wrap';
  const align = !nested && (resolved.align === 'center' || resolved.align === 'right') ? resolved.align : undefined;

  const needsBox =
    !nested &&
    (Object.keys(layout).length > 0 ||
      resolved.backgroundColor !== undefined ||
      (lines !== undefined && (lines > 1 || clip)) ||
      align !== undefined ||
      onLayout !== undefined ||
      ref !== undefined);

  const a11y = resolveAccessibility(props);
  const inkProps = {
    ...resolved.ink,
    backgroundColor: needsBox ? undefined : resolved.backgroundColor,
    dimColor: dim || undefined,
    inverse: inverse || undefined,
    'aria-label': a11y['aria-label'] as string | undefined,
    'aria-hidden': a11y['aria-hidden'] as boolean | undefined,
  };
  const content = transformChildren(children, transform);

  let element: ReactNode;
  if (nested) {
    element = <InkText {...inkProps}>{content}</InkText>;
    if (resolved.hidden) element = <Transform transform={blankLine}>{element}</Transform>;
  } else if (hidden || align) {
    const lineTransform: LineTransform = (line) => {
      const visible = hidden ? blankLine(line, 0) : line;
      return align ? alignLine(visible, innerWidth(boxRef.current), align) : visible;
    };
    element = textHost(wrap, lineTransform, <InkText {...inkProps}>{content}</InkText>);
  } else {
    element = (
      <InkText {...inkProps} wrap={wrap}>
        {content}
      </InkText>
    );
  }

  element = (
    <TextInheritanceContext.Provider value={inheritance}>
      <TextAncestorContext.Provider value={true}>{element}</TextAncestorContext.Provider>
    </TextInheritanceContext.Provider>
  );

  if (!needsBox) return element;

  const view = resolveViewStyle(
    { ...layout, opacity: textStyle.opacity },
    { component: 'Text', defaults: TEXT_BOX_DEFAULTS },
  );
  const box = { ...view.box };
  if (resolved.backgroundColor !== undefined && !hidden) box.backgroundColor = resolved.backgroundColor;
  if (lines !== undefined && (lines > 1 || clip)) {
    box.maxHeight =
      lines +
      numericSide(box.paddingTop) +
      numericSide(box.paddingBottom) +
      (box.borderTop ? 1 : 0) +
      (box.borderBottom ? 1 : 0);
    box.overflowY = 'hidden';
  }
  return (
    <Box ref={boxRef} {...box}>
      {element}
      {onLayout ? <LayoutObserver target={boxRef} onLayout={onLayout} /> : null}
    </Box>
  );
}

function PressableText(props: TextProps) {
  const { onPress, onPressIn, onPressOut, disabled } = props;
  const focusable = useFocusable({ enabled: !disabled });
  useInput(
    (input, key) => {
      if (!key.return && input !== ' ') return;
      const event = createPressEvent('press');
      onPressIn?.(event);
      onPressOut?.(event);
      onPress?.(event);
    },
    { isActive: focusable.receivesInput && !disabled },
  );
  return <TextImpl {...props} focusInverse={focusable.isFocused} />;
}

/** Displays text. Nested `<Text>` inherits styles, like React Native. */
export function Text(props: TextProps) {
  const pressable = props.onPress || props.onPressIn || props.onPressOut || props.onLongPress;
  return pressable ? <PressableText {...props} /> : <TextImpl {...props} />;
}
