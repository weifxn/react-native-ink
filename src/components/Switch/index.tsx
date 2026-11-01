import type { Ref } from 'react';
import { createSyntheticEvent, type NativeSyntheticEvent } from '../../internal/events.js';
import { isUnicodeSupported } from '../../internal/terminal.js';
import type { ColorValue } from '../../style/types.js';
import { PressableBase, type FocusableInstance } from '../Pressable/index.js';
import { InternalText, Text } from '../Text/index.js';
import type { ViewProps } from '../View/index.js';

export type SwitchChangeEvent = NativeSyntheticEvent<{ value: boolean }>;

export interface SwitchProps extends Omit<ViewProps, 'ref' | 'children'> {
  value?: boolean | null;
  onValueChange?: ((value: boolean) => Promise<void> | void) | null;
  onChange?: ((event: SwitchChangeEvent) => Promise<void> | void) | null;
  disabled?: boolean | null;
  /** Track color when off/on (defaults: gray / green). */
  trackColor?: { false?: ColorValue | null; true?: ColorValue | null } | null;
  thumbColor?: ColorValue | null;
  /** Terminal extension: take focus on mount if nothing else is focused. */
  autoFocus?: boolean;
  /** @remarks Ignored in terminals. */
  ios_backgroundColor?: ColorValue | null;
  ref?: Ref<FocusableInstance | null>;
}

/** A toggle: `[● ]` off, `[ ●]` on. Space or Enter flips it while focused. */
export function Switch({
  value,
  onValueChange,
  onChange,
  disabled,
  trackColor,
  thumbColor,
  autoFocus,
  ios_backgroundColor: _iosBackground,
  ref,
  ...viewProps
}: SwitchProps) {
  const on = Boolean(value);
  const thumb = isUnicodeSupported() ? '●' : '*';
  const track = on ? (trackColor?.true ?? 'green') : (trackColor?.false ?? 'gray');
  return (
    <PressableBase
      {...viewProps}
      disabled={disabled}
      autoFocus={autoFocus}
      accessibilityRole="switch"
      accessibilityState={{ checked: on, disabled: Boolean(disabled) }}
      style={[{ flexDirection: 'row', alignSelf: 'flex-start' }, viewProps.style as never]}
      focusIndicator={false}
      component="Switch"
      ref={ref}
      onPress={() => {
        const next = !on;
        void onChange?.(createSyntheticEvent('change', { value: next }));
        void onValueChange?.(next);
      }}
    >
      {({ focused }) => (
        <InternalText
          style={{ color: track, opacity: disabled ? 0.5 : undefined }}
          focusInverse={focused && !disabled}
        >
          [{on ? ' ' : ''}
          <Text style={{ color: thumbColor ?? track }}>{thumb}</Text>
          {on ? '' : ' '}]
        </InternalText>
      )}
    </PressableBase>
  );
}
