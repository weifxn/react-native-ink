import { warnOnce } from '../internal/warn.js';
import type { StyleProp } from './types.js';

/**
 * Flattens a style prop (object, nested arrays, falsy values) into a single object.
 * A plain object is returned as-is (not copied); arrays are merged left to right.
 */
export function flattenStyle<T extends object>(style: StyleProp<T>): T | undefined {
  if (style === null || style === undefined || style === false || style === '') {
    return undefined;
  }
  if (typeof style === 'number') {
    warnOnce(
      'style:registered-number',
      'Numeric style handles are not supported; pass style objects instead.',
    );
    return undefined;
  }
  if (!Array.isArray(style)) {
    return style as T;
  }
  const result: Record<string, unknown> = {};
  for (const entry of style as ReadonlyArray<StyleProp<T>>) {
    const flat = flattenStyle(entry);
    if (flat) {
      Object.assign(result, flat);
    }
  }
  return result as T;
}
