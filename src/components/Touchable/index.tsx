import { Children, useContext, useMemo, type ReactElement, type ReactNode } from 'react';
import { useInput } from 'ink';
import type { AccessibilityProps } from '../../internal/accessibility.js';
import { TextInheritanceContext } from '../../internal/contexts.js';
import { createPressEvent, type GestureResponderEvent, type LayoutChangeEvent } from '../../internal/events.js';
import { useFocusable } from '../../internal/focus.js';
import type { ColorValue, StyleProp, ViewStyle } from '../../style/types.js';
import { PressableBase, type FocusableInstance } from '../Pressable/index.js';
import type { Insets } from '../View/index.js';
import type { Ref } from 'react';

export interface TouchableWithoutFeedbackProps extends AccessibilityProps {
  children?: ReactNode;
  onPress?: ((event: GestureResponderEvent) => void) | null;
  onPressIn?: ((event: GestureResponderEvent) => void) | null;
  onPressOut?: ((event: GestureResponderEvent) => void) | null;
  /** @remarks Not triggered from the keyboard. */
  onLongPress?: ((event: GestureResponderEvent) => void) | null;
  onFocus?: ((event: unknown) => void) | null;
  onBlur?: ((event: unknown) => void) | null;
  onLayout?: ((event: LayoutChangeEvent) => void) | null;
  disabled?: boolean | null;
  focusable?: boolean;
  /** Terminal extension: take focus on mount if nothing else is focused. */
  autoFocus?: boolean;
  testID?: string;
  nativeID?: string;
  /** @remarks Ignored in terminals. */
  delayLongPress?: number;
  /** @remarks Ignored in terminals. */
  delayPressIn?: number;
  /** @remarks Ignored in terminals. */
  delayPressOut?: number;
  /** @remarks Ignored in terminals. */
  hitSlop?: Insets | number;
  /** @remarks Ignored in terminals. */
  pressRetentionOffset?: Insets | number;
  /** @remarks Ignored in terminals. */
  touchSoundDisabled?: boolean;
  /** @remarks Ignored in terminals. */
  rejectResponderTermination?: boolean;
  /** @remarks Ignored in terminals. */
  hasTVPreferredFocus?: boolean;
}

export interface TouchableOpacityProps extends TouchableWithoutFeedbackProps {
  style?: StyleProp<ViewStyle>;
  /** Below 1 (default 0.2), content is dimmed while pressed. */
  activeOpacity?: number;
  ref?: Ref<FocusableInstance | null>;
}

export interface TouchableHighlightProps extends TouchableWithoutFeedbackProps {
  style?: StyleProp<ViewStyle>;
  /** Background while pressed; inverse video when unset. */
  underlayColor?: ColorValue;
  activeOpacity?: number;
  onShowUnderlay?: () => void;
  onHideUnderlay?: () => void;
  ref?: Ref<FocusableInstance | null>;
}

const touchableProps = ({
  delayLongPress: _a,
  delayPressIn: _b,
  delayPressOut: _c,
  hitSlop: _d,
  pressRetentionOffset: _e,
  touchSoundDisabled: _f,
  rejectResponderTermination: _g,
  hasTVPreferredFocus: _h,
  onLayout,
  ...rest
}: TouchableWithoutFeedbackProps) => ({ ...rest, onLayout: onLayout ?? undefined, onFocus: rest.onFocus ?? undefined, onBlur: rest.onBlur ?? undefined });

/** A View that dims its content while pressed. Focus with Tab; press with Enter or Space. */
export function TouchableOpacity({ activeOpacity = 0.2, style, ref, ...props }: TouchableOpacityProps) {
  return (
    <PressableBase
      {...touchableProps(props)}
      style={style}
      ref={ref}
      feedback={activeOpacity < 1 ? 'opacity' : 'none'}
      component="TouchableOpacity"
    />
  );
}

/** A View that shows `underlayColor` (or inverse video) while pressed. */
export function TouchableHighlight({
  underlayColor,
  activeOpacity: _activeOpacity,
  onShowUnderlay: _onShowUnderlay,
  onHideUnderlay: _onHideUnderlay,
  style,
  ref,
  ...props
}: TouchableHighlightProps) {
  return (
    <PressableBase
      {...touchableProps(props)}
      style={style}
      ref={ref}
      feedback="highlight"
      underlayColor={underlayColor}
      component="TouchableHighlight"
    />
  );
}

/** Wraps a single child without adding a View; the child is shown in inverse video while focused. */
function TouchableNoWrapper({
  props,
  highlight,
}: {
  props: TouchableWithoutFeedbackProps;
  highlight: boolean;
}): ReactElement {
  const { children, onPress, onPressIn, onPressOut, disabled, focusable = true, autoFocus } = props;
  const isDisabled = Boolean(disabled);
  const focus = useFocusable({
    enabled: focusable && !isDisabled,
    autoFocus,
    onFocus: () => props.onFocus?.({ nativeEvent: {} }),
    onBlur: () => props.onBlur?.({ nativeEvent: {} }),
  });
  useInput(
    (input, key) => {
      if (!key.return && input !== ' ') return;
      const event = createPressEvent('press');
      onPressIn?.(event);
      onPressOut?.(event);
      onPress?.(event);
    },
    { isActive: focus.receivesInput && !isDisabled },
  );
  const inherited = useContext(TextInheritanceContext);
  const inverse = inherited.inverse || (focus.isFocused && highlight);
  const value = useMemo(() => ({ ...inherited, inverse }), [inherited, inverse]);
  return <TextInheritanceContext.Provider value={value}>{Children.only(children)}</TextInheritanceContext.Provider>;
}

/** Makes its single child focusable and pressable without adding a View. */
export function TouchableWithoutFeedback(props: TouchableWithoutFeedbackProps) {
  return <TouchableNoWrapper props={props} highlight />;
}

export interface TouchableNativeFeedbackProps extends TouchableWithoutFeedbackProps {
  background?: unknown;
  useForeground?: boolean;
}

/** Android ripple touchable: behaves like TouchableWithoutFeedback in a terminal. */
export function TouchableNativeFeedback({ background: _background, useForeground: _useForeground, ...props }: TouchableNativeFeedbackProps) {
  return <TouchableNoWrapper props={props} highlight />;
}
TouchableNativeFeedback.SelectableBackground = (rippleRadius?: number | null) => ({
  type: 'ThemeAttrAndroid' as const,
  attribute: 'selectableItemBackground' as const,
  rippleRadius,
});
TouchableNativeFeedback.SelectableBackgroundBorderless = (rippleRadius?: number | null) => ({
  type: 'ThemeAttrAndroid' as const,
  attribute: 'selectableItemBackgroundBorderless' as const,
  rippleRadius,
});
TouchableNativeFeedback.Ripple = (color: string, borderless: boolean, rippleRadius?: number | null) => ({
  type: 'RippleAndroid' as const,
  color,
  borderless,
  rippleRadius,
});
TouchableNativeFeedback.canUseNativeForeground = (): boolean => false;
