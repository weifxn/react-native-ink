import type { Ref } from 'react';
import type { AccessibilityState } from '../../internal/accessibility.js';
import type { GestureResponderEvent } from '../../internal/events.js';
import type { ColorValue } from '../../style/types.js';
import { PressableBase, type FocusableInstance } from '../Pressable/index.js';
import { InternalText } from '../Text/index.js';

export interface ButtonProps {
  title: string;
  onPress?: (event: GestureResponderEvent) => void;
  /** Text color of the button. */
  color?: ColorValue;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityState?: AccessibilityState;
  accessibilityLanguage?: string;
  testID?: string;
  /** Terminal extension: take focus on mount if nothing else is focused. */
  autoFocus?: boolean;
  /** @remarks Ignored in terminals. */
  touchSoundDisabled?: boolean;
  /** @remarks Ignored in terminals. */
  hasTVPreferredFocus?: boolean;
  /** @remarks Ignored in terminals. */
  nextFocusDown?: number;
  /** @remarks Ignored in terminals. */
  nextFocusForward?: number;
  /** @remarks Ignored in terminals. */
  nextFocusLeft?: number;
  /** @remarks Ignored in terminals. */
  nextFocusRight?: number;
  /** @remarks Ignored in terminals. */
  nextFocusUp?: number;
  ref?: Ref<FocusableInstance | null>;
}

/** Renders `[ Title ]`: inverse video while focused, bold while pressed, dim when disabled. */
export function Button({
  title,
  onPress,
  color,
  disabled,
  accessibilityLabel,
  accessibilityHint,
  accessibilityState,
  testID,
  autoFocus,
  ref,
}: ButtonProps) {
  return (
    <PressableBase
      onPress={onPress}
      disabled={disabled}
      autoFocus={autoFocus}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(disabled), ...accessibilityState }}
      style={{ flexDirection: 'row' }}
      focusIndicator={false}
      component="Button"
      ref={ref}
    >
      {({ focused, pressed }) => (
        <InternalText
          style={{
            color: disabled ? undefined : color,
            fontWeight: pressed ? 'bold' : undefined,
            opacity: disabled ? 0.5 : undefined,
          }}
          focusInverse={focused && !disabled}
        >
          {`[ ${title} ]`}
        </InternalText>
      )}
    </PressableBase>
  );
}
