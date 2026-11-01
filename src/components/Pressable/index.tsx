import { useEffect, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from 'react';
import { useInput, type DOMElement } from 'ink';
import {
  createPressEvent,
  createSyntheticEvent,
  type GestureResponderEvent,
  type NativeSyntheticEvent,
} from '../../internal/events.js';
import { useFocusable } from '../../internal/focus.js';
import { attachNativeMethods, type HostInstance } from '../../internal/nativeMethods.js';
import { resolveColor } from '../../style/colors.js';
import type { ColorValue, StyleProp, ViewStyle } from '../../style/types.js';
import { View, type Insets, type ViewProps } from '../View/index.js';

/** How long the pressed state stays visible after a keyboard press. */
export const PRESS_FEEDBACK_MS = 100;

export interface PressableStateCallbackType {
  readonly pressed: boolean;
  /** Terminal extension: true while the component has keyboard focus. */
  readonly focused: boolean;
  readonly hovered: boolean;
}

export interface PressableAndroidRippleConfig {
  color?: ColorValue;
  borderless?: boolean;
  radius?: number;
  foreground?: boolean;
}

/** A focusable component: methods available on its ref. */
export interface FocusableInstance extends HostInstance {
  focus(): void;
  blur(): void;
  isFocused(): boolean;
}

export interface PressableProps extends Omit<ViewProps, 'children' | 'style' | 'ref'> {
  children?: ReactNode | ((state: PressableStateCallbackType) => ReactNode);
  style?: StyleProp<ViewStyle> | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>);
  /** Called when the focused component is activated with Enter or Space. */
  onPress?: ((event: GestureResponderEvent) => void) | null;
  onPressIn?: ((event: GestureResponderEvent) => void) | null;
  onPressOut?: ((event: GestureResponderEvent) => void) | null;
  /** @remarks Not triggered from the keyboard. */
  onLongPress?: ((event: GestureResponderEvent) => void) | null;
  onFocus?: ((event: NativeSyntheticEvent<object>) => void) | null;
  onBlur?: ((event: NativeSyntheticEvent<object>) => void) | null;
  disabled?: boolean | null;
  /** Set to false to keep it out of the Tab order. */
  focusable?: boolean;
  /** Terminal extension: take focus on mount if nothing else is focused. */
  autoFocus?: boolean;
  /** @remarks Ignored in terminals. */
  onHoverIn?: ((event: unknown) => void) | null;
  /** @remarks Ignored in terminals. */
  onHoverOut?: ((event: unknown) => void) | null;
  /** @remarks Ignored in terminals. */
  delayLongPress?: number | null;
  /** @remarks Ignored in terminals. */
  unstable_pressDelay?: number;
  /** @remarks Ignored in terminals. */
  pressRetentionOffset?: Insets | number | null;
  /** @remarks Ignored in terminals. */
  android_ripple?: PressableAndroidRippleConfig | null;
  /** @remarks Ignored in terminals. */
  android_disableSound?: boolean | null;
  /** @remarks Ignored in terminals. */
  cancelable?: boolean | null;
  /** Renders in the pressed state (for tests). */
  testOnly_pressed?: boolean | null;
  ref?: Ref<FocusableInstance | null>;
}

export interface PressableBaseProps extends PressableProps {
  /** Visual feedback while pressed. */
  feedback?: 'none' | 'opacity' | 'highlight';
  /** Background while pressed (`highlight` feedback); inverse video when unset. */
  underlayColor?: ColorValue;
  /** Show inverse text while focused unless `style`/`children` are functions. Default true. */
  focusIndicator?: boolean;
  component?: string;
}

/** Shared implementation of Pressable and the Touchable* components. */
export function PressableBase(props: PressableBaseProps) {
  const {
    children,
    style,
    onPress,
    onPressIn,
    onPressOut,
    onFocus,
    onBlur,
    disabled,
    focusable = true,
    autoFocus,
    testOnly_pressed,
    feedback = 'none',
    underlayColor,
    focusIndicator = true,
    component = 'Pressable',
    ref,
    onLongPress: _onLongPress,
    onHoverIn: _onHoverIn,
    onHoverOut: _onHoverOut,
    delayLongPress: _delayLongPress,
    unstable_pressDelay: _pressDelay,
    pressRetentionOffset: _pressRetentionOffset,
    android_ripple: _ripple,
    android_disableSound: _disableSound,
    cancelable: _cancelable,
    ...viewProps
  } = props;
  const isDisabled = Boolean(disabled);
  const boxRef = useRef<DOMElement>(null);
  const focus = useFocusable({
    enabled: focusable && !isDisabled,
    autoFocus,
    nodeRef: boxRef,
    onFocus: () => onFocus?.(createSyntheticEvent('focus', {}, boxRef.current)),
    onBlur: () => onBlur?.(createSyntheticEvent('blur', {}, boxRef.current)),
  });
  const [pressed, setPressed] = useState(Boolean(testOnly_pressed));
  const timer = useRef<NodeJS.Timeout | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  useInput(
    (input, key) => {
      if (!key.return && input !== ' ') return;
      const event = createPressEvent('press', boxRef.current);
      onPressIn?.(event);
      setPressed(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setPressed(Boolean(testOnly_pressed)), PRESS_FEEDBACK_MS);
      onPressOut?.(event);
      onPress?.(event);
    },
    { isActive: focus.receivesInput && !isDisabled },
  );

  const focusRef = useRef(focus);
  focusRef.current = focus;
  useImperativeHandle(
    ref,
    () =>
      boxRef.current
        ? Object.assign(
            attachNativeMethods(boxRef.current, {
              focus: () => focusRef.current.focus(),
              blur: () => focusRef.current.blur(),
            }),
            { isFocused: () => focusRef.current.isFocused },
          )
        : (null as unknown as FocusableInstance),
    [],
  );

  const state: PressableStateCallbackType = { pressed, focused: focus.isFocused, hovered: false };
  const resolvedStyle = typeof style === 'function' ? style(state) : style;
  const content = typeof children === 'function' ? children(state) : children;
  const customVisuals = typeof style === 'function' || typeof children === 'function';

  let highlightBackground: string | undefined;
  let highlightInverse = false;
  if (pressed && feedback === 'highlight') {
    const resolved = underlayColor !== undefined ? resolveColor(underlayColor) : undefined;
    if (resolved?.color) highlightBackground = resolved.color;
    else highlightInverse = true;
  }

  return (
    <View
      accessibilityRole="button"
      {...viewProps}
      accessibilityState={{ disabled: isDisabled, ...viewProps.accessibilityState }}
      style={resolvedStyle}
      component={component}
      boxRef={boxRef}
      overrideBox={highlightBackground ? { backgroundColor: highlightBackground } : undefined}
      inverseText={(focusIndicator && focus.isFocused && !customVisuals) || highlightInverse}
      dimText={pressed && feedback === 'opacity'}
    >
      {content}
    </View>
  );
}

/**
 * A focusable, pressable container. Tab moves focus to it; Enter or Space presses it.
 * `style` and `children` can be functions of `{pressed, focused, hovered}`.
 */
export function Pressable(props: PressableProps) {
  return <PressableBase {...props} />;
}
