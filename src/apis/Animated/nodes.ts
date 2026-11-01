import normalizeColor from '@react-native/normalize-colors';
import type { Animation, EndCallback } from './animations.js';
import { createInterpolation, type InterpolationConfigType } from './interpolate.js';

export type ValueListenerCallback = (state: { value: any }) => void;

let nextListenerId = 1;

/** Base class of every animated value. */
export abstract class AnimatedNode {
  #listeners = new Map<string, () => void>();

  abstract __getValue(): any;

  /** Nodes this one derives from (empty for root values). */
  __getParents(): AnimatedNode[] {
    return [];
  }

  __getAnimatedValue(): any {
    return this.__getValue();
  }

  /** Calls `callback` whenever any root value this node depends on changes. */
  __subscribe(callback: () => void): () => void {
    const unsubscribers = [...rootValues(this)].map((value) => value.__onChange(callback));
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }

  interpolate<OutputT extends number | string>(config: InterpolationConfigType<OutputT>): AnimatedInterpolation<OutputT> {
    return new AnimatedInterpolation(this, config);
  }

  addListener(callback: ValueListenerCallback): string {
    const id = String(nextListenerId++);
    this.#listeners.set(
      id,
      this.__subscribe(() => callback({ value: this.__getValue() })),
    );
    return id;
  }

  removeListener(id: string): void {
    this.#listeners.get(id)?.();
    this.#listeners.delete(id);
  }

  removeAllListeners(): void {
    this.#listeners.forEach((unsubscribe) => unsubscribe());
    this.#listeners.clear();
  }

  hasListeners(): boolean {
    return this.#listeners.size > 0;
  }
}

/** Collects the root `Animated.Value`s a node depends on. */
export function rootValues(node: AnimatedNode, out = new Set<AnimatedValue>()): Set<AnimatedValue> {
  if (node instanceof AnimatedValue) out.add(node);
  else node.__getParents().forEach((parent) => rootValues(parent, out));
  return out;
}

/** A single animatable number (`Animated.Value`). */
export class AnimatedValue extends AnimatedNode {
  _value: number;
  _offset = 0;
  _startingValue: number;
  _animation: Animation | undefined;
  #changeCallbacks = new Set<() => void>();

  constructor(value = 0, _config?: { useNativeDriver?: boolean }) {
    super();
    this._value = value;
    this._startingValue = value;
  }

  __getValue(): number {
    return this._value + this._offset;
  }

  __onChange(callback: () => void): () => void {
    this.#changeCallbacks.add(callback);
    return () => {
      this.#changeCallbacks.delete(callback);
    };
  }

  #notify() {
    for (const callback of [...this.#changeCallbacks]) callback();
  }

  /** Sets the value immediately, stopping any running animation. */
  setValue(value: number): void {
    if (this._animation) {
      this._animation.stop();
      this._animation = undefined;
    }
    this._updateValue(value);
  }

  setOffset(offset: number): void {
    this._offset = offset;
    this.#notify();
  }

  flattenOffset(): void {
    this._value += this._offset;
    this._offset = 0;
    this.#notify();
  }

  extractOffset(): void {
    this._offset += this._value;
    this._value = 0;
    this.#notify();
  }

  stopAnimation(callback?: (value: number) => void): void {
    this._animation?.stop();
    this._animation = undefined;
    callback?.(this.__getValue());
  }

  resetAnimation(callback?: (value: number) => void): void {
    this.stopAnimation(callback);
    this._updateValue(this._startingValue);
  }

  /** Runs an animation on this value (used by Animated.timing/spring/decay). */
  animate(animation: Animation, callback?: EndCallback): void {
    const previous = this._animation;
    this._animation?.stop();
    this._animation = animation;
    animation.start(
      this._value,
      (value) => this._updateValue(value),
      (result) => {
        if (this._animation === animation) this._animation = undefined;
        callback?.(result);
      },
      previous,
      this,
    );
  }

  _updateValue(value: number): void {
    this._value = value;
    this.#notify();
  }
}

type XY = { x: number; y: number };

/** A pair of values for 2D animations (`Animated.ValueXY`). */
export class AnimatedValueXY extends AnimatedNode {
  x: AnimatedValue;
  y: AnimatedValue;

  constructor(value?: { x: number | AnimatedValue; y: number | AnimatedValue }, config?: { useNativeDriver?: boolean }) {
    super();
    const initial = value ?? { x: 0, y: 0 };
    this.x = initial.x instanceof AnimatedValue ? initial.x : new AnimatedValue(initial.x, config);
    this.y = initial.y instanceof AnimatedValue ? initial.y : new AnimatedValue(initial.y, config);
  }

  __getValue(): XY {
    return { x: this.x.__getValue(), y: this.y.__getValue() };
  }

  override __getParents(): AnimatedNode[] {
    return [this.x, this.y];
  }

  setValue(value: XY): void {
    this.x.setValue(value.x);
    this.y.setValue(value.y);
  }

  setOffset(offset: XY): void {
    this.x.setOffset(offset.x);
    this.y.setOffset(offset.y);
  }

  flattenOffset(): void {
    this.x.flattenOffset();
    this.y.flattenOffset();
  }

  extractOffset(): void {
    this.x.extractOffset();
    this.y.extractOffset();
  }

  stopAnimation(callback?: (value: XY) => void): void {
    this.x.stopAnimation();
    this.y.stopAnimation();
    callback?.(this.__getValue());
  }

  resetAnimation(callback?: (value: XY) => void): void {
    this.x.resetAnimation();
    this.y.resetAnimation();
    callback?.(this.__getValue());
  }

  /** `{left, top}` for absolutely positioned views. */
  getLayout(): { left: AnimatedValue; top: AnimatedValue } {
    return { left: this.x, top: this.y };
  }

  getTranslateTransform(): [{ translateX: AnimatedValue }, { translateY: AnimatedValue }] {
    return [{ translateX: this.x }, { translateY: this.y }];
  }
}

type RGBA = { r: number; g: number; b: number; a: number };

function parseColor(value: string | RGBA): RGBA {
  if (typeof value !== 'string') return value;
  const int = normalizeColor(value);
  if (int === null) return { r: 0, g: 0, b: 0, a: 1 };
  const rgba = int >>> 0;
  return { r: (rgba >>> 24) & 255, g: (rgba >>> 16) & 255, b: (rgba >>> 8) & 255, a: (rgba & 255) / 255 };
}

/** An animatable color (`Animated.Color`). */
export class AnimatedColor extends AnimatedNode {
  r: AnimatedValue;
  g: AnimatedValue;
  b: AnimatedValue;
  a: AnimatedValue;

  constructor(value: string | RGBA = 'rgba(0, 0, 0, 1)') {
    super();
    const color = parseColor(value);
    this.r = new AnimatedValue(color.r);
    this.g = new AnimatedValue(color.g);
    this.b = new AnimatedValue(color.b);
    this.a = new AnimatedValue(color.a);
  }

  __getValue(): string {
    const channel = (value: AnimatedValue) => Math.round(Math.min(255, Math.max(0, value.__getValue())));
    const alpha = Math.min(1, Math.max(0, this.a.__getValue()));
    return `rgba(${channel(this.r)}, ${channel(this.g)}, ${channel(this.b)}, ${alpha})`;
  }

  override __getParents(): AnimatedNode[] {
    return [this.r, this.g, this.b, this.a];
  }

  setValue(value: string | RGBA): void {
    const color = parseColor(value);
    this.r.setValue(color.r);
    this.g.setValue(color.g);
    this.b.setValue(color.b);
    this.a.setValue(color.a);
  }

  setOffset(offset: RGBA): void {
    this.r.setOffset(offset.r);
    this.g.setOffset(offset.g);
    this.b.setOffset(offset.b);
    this.a.setOffset(offset.a);
  }

  flattenOffset(): void {
    [this.r, this.g, this.b, this.a].forEach((value) => value.flattenOffset());
  }

  extractOffset(): void {
    [this.r, this.g, this.b, this.a].forEach((value) => value.extractOffset());
  }

  stopAnimation(callback?: (value: string) => void): void {
    [this.r, this.g, this.b, this.a].forEach((value) => value.stopAnimation());
    callback?.(this.__getValue());
  }

  resetAnimation(callback?: (value: string) => void): void {
    [this.r, this.g, this.b, this.a].forEach((value) => value.resetAnimation());
    callback?.(this.__getValue());
  }
}

export { parseColor };

/** A value mapped through `interpolate()`. */
export class AnimatedInterpolation<OutputT extends number | string = number | string> extends AnimatedNode {
  #parent: AnimatedNode;
  #interpolate: (input: number) => number | string;

  constructor(parent: AnimatedNode, config: InterpolationConfigType<OutputT>) {
    super();
    this.#parent = parent;
    this.#interpolate = createInterpolation(config);
  }

  __getValue(): OutputT {
    return this.#interpolate(Number(this.#parent.__getValue())) as OutputT;
  }

  override __getParents(): AnimatedNode[] {
    return [this.#parent];
  }
}

type Operand = AnimatedNode | number;
const valueOf = (operand: Operand): number => (typeof operand === 'number' ? operand : Number(operand.__getValue()));

/** Arithmetic on animated values (`Animated.add`, `subtract`, ...). */
export class AnimatedOperation extends AnimatedNode {
  #a: Operand;
  #b: Operand;
  #operate: (a: number, b: number) => number;

  constructor(a: Operand, b: Operand, operate: (a: number, b: number) => number) {
    super();
    this.#a = a;
    this.#b = b;
    this.#operate = operate;
  }

  __getValue(): number {
    return this.#operate(valueOf(this.#a), valueOf(this.#b));
  }

  override __getParents(): AnimatedNode[] {
    return [this.#a, this.#b].filter((operand): operand is AnimatedNode => typeof operand !== 'number');
  }
}

/** Follows changes of a value but clamps the running result (`Animated.diffClamp`). */
export class AnimatedDiffClamp extends AnimatedNode {
  #a: AnimatedNode;
  #min: number;
  #max: number;
  #value: number;
  #last: number;

  constructor(a: AnimatedNode, min: number, max: number) {
    super();
    this.#a = a;
    this.#min = min;
    this.#max = max;
    this.#last = Number(a.__getValue());
    this.#value = Math.min(Math.max(this.#last, min), max);
  }

  __getValue(): number {
    const value = Number(this.#a.__getValue());
    const diff = value - this.#last;
    this.#last = value;
    this.#value = Math.min(Math.max(this.#value + diff, this.#min), this.#max);
    return this.#value;
  }

  override __getParents(): AnimatedNode[] {
    return [this.#a];
  }
}
