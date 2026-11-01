import { flattenStyle } from '../style/flatten.js';
import type { ImageStyle, StyleProp, TextStyle, ViewStyle } from '../style/types.js';

type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

const absoluteFill = Object.freeze({
  position: 'absolute',
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
} as const);

/** React Native's `StyleSheet`. Styles are plain objects; `create` returns its argument. */
export const StyleSheet = {
  /** Borders are always one cell thick in a terminal. */
  hairlineWidth: 1,
  absoluteFill: absoluteFill as ViewStyle,
  absoluteFillObject: absoluteFill as {
    position: 'absolute';
    left: 0;
    right: 0;
    top: 0;
    bottom: 0;
  },
  create<T extends NamedStyles<T> | NamedStyles<any>>(styles: T & NamedStyles<any>): T {
    return styles;
  },
  flatten<T extends object>(style?: StyleProp<T>): T {
    return (flattenStyle(style) ?? {}) as T;
  },
  compose<U extends object, V extends object>(
    style1: StyleProp<U> | undefined,
    style2: StyleProp<V> | undefined,
  ): StyleProp<U | V> {
    if (style1 && style2) return [style1, style2] as StyleProp<U | V>;
    return (style1 || style2) as StyleProp<U | V>;
  },
  setStyleAttributePreprocessor(_property: string, _process: (nextProp: unknown) => unknown): void {},
};
