import { useEffect, useReducer, type ComponentType, type ReactElement } from 'react';
import { AnimatedNode, rootValues, type AnimatedValue } from './nodes.js';

type Nullable = undefined | null;
type Primitive = string | number | boolean | symbol | bigint;
type Builtin = ((...args: any[]) => any) | Date | Error | RegExp;

/** A value or a structure where any primitive may be an animated node. */
export type WithAnimatedValue<T> = T extends Builtin | Nullable
  ? T
  : T extends Primitive
    ? T | AnimatedNode
    : T extends ReadonlyArray<infer P>
      ? ReadonlyArray<WithAnimatedValue<P>>
      : T extends object
        ? { [K in keyof T]: WithAnimatedValue<T[K]> }
        : T;

export type AnimatedProps<Props> = {
  [K in keyof Props]: K extends 'ref' | 'children' ? Props[K] : WithAnimatedValue<Props[K]>;
};

export type AnimatedComponent<Props> = ((props: AnimatedProps<Props>) => ReactElement) & {
  displayName?: string;
};

const DEEP = 8;
const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype;

function collect(value: unknown, out: Set<AnimatedValue>, depth: number) {
  if (value instanceof AnimatedNode) {
    rootValues(value, out);
  } else if (depth > 0 && Array.isArray(value)) {
    value.forEach((entry) => collect(entry, out, depth - 1));
  } else if (depth > 0 && isPlainObject(value)) {
    Object.values(value).forEach((entry) => collect(entry, out, depth - 1));
  }
}

function resolve(value: unknown, depth: number): unknown {
  if (value instanceof AnimatedNode) return value.__getValue();
  if (depth > 0 && Array.isArray(value)) return value.map((entry) => resolve(entry, depth - 1));
  if (depth > 0 && isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) result[key] = resolve(entry, depth - 1);
    return result;
  }
  return value;
}

const depthFor = (key: string) => (key === 'style' || key.endsWith('Style') ? DEEP : 0);

/**
 * Makes a component accept animated values in its props and `style`; it re-renders whenever
 * one of those values changes.
 */
export function createAnimatedComponent<Props extends object>(
  Component: ComponentType<Props>,
): AnimatedComponent<Props> {
  function Animated(props: AnimatedProps<Props>) {
    const [, rerender] = useReducer((count: number) => count + 1, 0);
    const roots = new Set<AnimatedValue>();
    const resolved: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(props as Record<string, unknown>)) {
      const depth = depthFor(key);
      collect(value, roots, depth);
      resolved[key] = resolve(value, depth);
    }
    useEffect(() => {
      const unsubscribers = [...roots].map((root) => root.__onChange(rerender));
      return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
    });
    return <Component {...(resolved as Props)} />;
  }
  Animated.displayName = `Animated(${Component.displayName ?? Component.name ?? 'Component'})`;
  return Animated as AnimatedComponent<Props>;
}
