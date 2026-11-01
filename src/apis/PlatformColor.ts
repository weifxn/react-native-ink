import { createPlatformColor } from '../style/colors.js';
import type { OpaqueColorValue } from '../style/types.js';

/**
 * Refers to the terminal palette: `'red'`, `'redBright'`, `'gray'`, ... or `'ansi256(208)'`.
 * The first name the terminal understands wins (so `PlatformColor('systemBlue', 'blue')` works).
 */
export function PlatformColor(...names: string[]): OpaqueColorValue {
  return createPlatformColor(names);
}
