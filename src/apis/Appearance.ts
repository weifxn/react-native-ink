import { useSyncExternalStore } from 'react';
import type { ColorValue, OpaqueColorValue } from '../style/types.js';
import type { EmitterSubscription } from './EventEmitter.js';

export type ColorSchemeName = 'light' | 'dark' | 'unspecified';

/**
 * Best-effort guess of the terminal background from `COLORFGBG` ("fg;bg", set by many
 * terminals). Background palette indexes 7 and 9–15 are light. Returns null when unknown.
 */
export function detectColorScheme(env: NodeJS.ProcessEnv = process.env): 'light' | 'dark' | null {
  const value = env.COLORFGBG;
  if (!value) return null;
  const background = Number(value.split(';').pop());
  if (!Number.isInteger(background)) return null;
  return background === 7 || (background >= 9 && background <= 15) ? 'light' : 'dark';
}

let override: 'light' | 'dark' | null = null;
const listeners = new Set<(preferences: { colorScheme: 'light' | 'dark' | null }) => void>();

const current = (): 'light' | 'dark' | null => override ?? detectColorScheme();

export const Appearance = {
  getColorScheme(): 'light' | 'dark' | null {
    return current();
  },
  /** Overrides the detected scheme; `null`/`'unspecified'` returns to detection. */
  setColorScheme(scheme: ColorSchemeName | null | undefined): void {
    override = scheme === 'light' || scheme === 'dark' ? scheme : null;
    const colorScheme = current();
    listeners.forEach((listener) => listener({ colorScheme }));
  },
  addChangeListener(
    listener: (preferences: { colorScheme: 'light' | 'dark' | null }) => void,
  ): EmitterSubscription {
    listeners.add(listener);
    return {
      remove: () => {
        listeners.delete(listener);
      },
    };
  },
};

const subscribe = (onChange: () => void) => {
  const subscription = Appearance.addChangeListener(onChange);
  return () => subscription.remove();
};

/** The current color scheme ('light', 'dark' or null when unknown). */
export function useColorScheme(): 'light' | 'dark' | null {
  return useSyncExternalStore(subscribe, current, current);
}

export interface DynamicColorIOSTuple {
  light: ColorValue;
  dark: ColorValue;
  highContrastLight?: ColorValue;
  highContrastDark?: ColorValue;
}

/** Picks `dark` or `light` based on the color scheme at call time. */
export function DynamicColorIOS(tuple: DynamicColorIOSTuple): OpaqueColorValue {
  return (current() === 'dark' ? tuple.dark : tuple.light) as OpaqueColorValue;
}
