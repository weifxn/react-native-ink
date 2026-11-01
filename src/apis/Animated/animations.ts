import { warnOnce } from '../../internal/warn.js';
import { Easing, type EasingFunction } from '../Easing.js';
import { AnimatedColor, AnimatedNode, AnimatedValue, AnimatedValueXY, parseColor } from './nodes.js';

export type EndResult = { finished: boolean; value?: number };
export type EndCallback = (result: EndResult) => void;

/** Animation frames run at ~60 Hz; Ink throttles terminal output separately. */
const FRAME_MS = 1000 / 60;
const frameQueue = new Set<(now: number) => void>();
let frameTimer: NodeJS.Timeout | undefined;

function flushFrames() {
  frameTimer = undefined;
  const now = performance.now();
  const callbacks = [...frameQueue];
  frameQueue.clear();
  for (const callback of callbacks) callback(now);
}

/** A `requestAnimationFrame` for Node. Returns a cancel function. */
export function requestFrame(callback: (now: number) => void): () => void {
  frameQueue.add(callback);
  frameTimer ??= setTimeout(flushFrames, FRAME_MS);
  return () => {
    frameQueue.delete(callback);
    if (frameQueue.size === 0 && frameTimer) {
      clearTimeout(frameTimer);
      frameTimer = undefined;
    }
  };
}

/** Base class of value animations. */
export abstract class Animation {
  protected active = false;
  #onEnd: EndCallback | undefined;
  #cancelFrame: (() => void) | undefined;
  #delayTimer: NodeJS.Timeout | undefined;

  abstract start(
    fromValue: number,
    onUpdate: (value: number) => void,
    onEnd: EndCallback,
    previousAnimation: Animation | undefined,
    animatedValue: AnimatedValue,
  ): void;

  protected begin(onEnd: EndCallback, delay: number, run: () => void) {
    this.active = true;
    this.#onEnd = onEnd;
    if (delay > 0) this.#delayTimer = setTimeout(run, delay);
    else run();
  }

  protected frame(callback: (now: number) => void) {
    this.#cancelFrame = requestFrame((now) => {
      if (this.active) callback(now);
    });
  }

  protected finish(finished: boolean) {
    this.active = false;
    const onEnd = this.#onEnd;
    this.#onEnd = undefined;
    onEnd?.({ finished });
  }

  stop(): void {
    if (!this.active) return;
    clearTimeout(this.#delayTimer);
    this.#cancelFrame?.();
    this.finish(false);
  }
}

export interface TimingAnimationConfig {
  toValue: number | { x: number; y: number } | string | AnimatedNode;
  duration?: number;
  easing?: EasingFunction;
  delay?: number;
  iterations?: number;
  isInteraction?: boolean;
  useNativeDriver: boolean;
}

const defaultEasing = Easing.inOut(Easing.ease);

class TimingAnimation extends Animation {
  #toValue: number;
  #duration: number;
  #easing: EasingFunction;
  #delay: number;

  constructor(config: { toValue: number; duration?: number; easing?: EasingFunction; delay?: number }) {
    super();
    this.#toValue = config.toValue;
    this.#duration = config.duration ?? 500;
    this.#easing = config.easing ?? defaultEasing;
    this.#delay = config.delay ?? 0;
  }

  start(fromValue: number, onUpdate: (value: number) => void, onEnd: EndCallback) {
    this.begin(onEnd, this.#delay, () => {
      if (this.#duration <= 0) {
        onUpdate(this.#toValue);
        this.finish(true);
        return;
      }
      const startTime = performance.now();
      const step = (now: number) => {
        const progress = Math.min(1, (now - startTime) / this.#duration);
        onUpdate(fromValue + this.#easing(progress) * (this.#toValue - fromValue));
        if (progress >= 1) this.finish(true);
        else this.frame(step);
      };
      this.frame(step);
    });
  }
}

export interface SpringAnimationConfig {
  toValue: number | { x: number; y: number } | string | AnimatedNode;
  overshootClamping?: boolean;
  restDisplacementThreshold?: number;
  restSpeedThreshold?: number;
  velocity?: number | { x: number; y: number };
  bounciness?: number;
  speed?: number;
  tension?: number;
  friction?: number;
  stiffness?: number;
  damping?: number;
  mass?: number;
  delay?: number;
  isInteraction?: boolean;
  useNativeDriver: boolean;
}

const stiffnessFromOrigami = (value: number) => (value - 30) * 3.62 + 194;
const dampingFromOrigami = (value: number) => (value - 8) * 3 + 25;

function fromBouncinessAndSpeed(bounciness: number, speed: number) {
  const normalize = (value: number, start: number, end: number) => (value - start) / (end - start);
  const project = (n: number, start: number, end: number) => start + n * (end - start);
  const linear = (t: number, start: number, end: number) => t * end + (1 - t) * start;
  const quadraticOut = (t: number, start: number, end: number) => linear(2 * t - t * t, start, end);
  const b3Friction1 = (x: number) => 0.0007 * x ** 3 - 0.031 * x ** 2 + 0.64 * x + 1.28;
  const b3Friction2 = (x: number) => 0.000044 * x ** 3 - 0.006 * x ** 2 + 0.36 * x + 2;
  const b3Friction3 = (x: number) => 0.00000045 * x ** 3 - 0.000332 * x ** 2 + 0.1078 * x + 5.84;
  const b3NoBounce = (tension: number) =>
    tension <= 18 ? b3Friction1(tension) : tension <= 44 ? b3Friction2(tension) : b3Friction3(tension);
  const b = project(normalize(bounciness / 1.7, 0, 20), 0, 0.8);
  const s = normalize(speed / 1.7, 0, 20);
  const bouncyTension = project(s, 0.5, 200);
  const bouncyFriction = quadraticOut(b, b3NoBounce(bouncyTension), 0.01);
  return { stiffness: stiffnessFromOrigami(bouncyTension), damping: dampingFromOrigami(bouncyFriction) };
}

class SpringAnimation extends Animation {
  #toValue: number;
  #velocity: number;
  #stiffness: number;
  #damping: number;
  #mass: number;
  #overshootClamping: boolean;
  #restDisplacement: number;
  #restSpeed: number;
  #delay: number;

  constructor(config: Omit<SpringAnimationConfig, 'toValue' | 'velocity'> & { toValue: number; velocity?: number }) {
    super();
    this.#toValue = config.toValue;
    this.#velocity = config.velocity ?? 0;
    this.#overshootClamping = config.overshootClamping ?? false;
    this.#restDisplacement = config.restDisplacementThreshold ?? 0.001;
    this.#restSpeed = config.restSpeedThreshold ?? 0.001;
    this.#delay = config.delay ?? 0;
    this.#mass = config.mass ?? 1;
    if (config.stiffness !== undefined || config.damping !== undefined || config.mass !== undefined) {
      this.#stiffness = config.stiffness ?? 100;
      this.#damping = config.damping ?? 10;
    } else if (config.bounciness !== undefined || config.speed !== undefined) {
      ({ stiffness: this.#stiffness, damping: this.#damping } = fromBouncinessAndSpeed(
        config.bounciness ?? 8,
        config.speed ?? 12,
      ));
    } else {
      this.#stiffness = stiffnessFromOrigami(config.tension ?? 40);
      this.#damping = dampingFromOrigami(config.friction ?? 7);
    }
  }

  start(fromValue: number, onUpdate: (value: number) => void, onEnd: EndCallback) {
    this.begin(onEnd, this.#delay, () => {
      const startTime = performance.now();
      const c = this.#damping;
      const m = this.#mass;
      const k = this.#stiffness;
      const v0 = -this.#velocity;
      const x0 = this.#toValue - fromValue;
      const zeta = c / (2 * Math.sqrt(k * m));
      const omega0 = Math.sqrt(k / m);
      const omega1 = omega0 * Math.sqrt(1 - zeta * zeta);
      const step = (now: number) => {
        const t = (now - startTime) / 1000;
        let position: number;
        let velocity: number;
        if (zeta < 1) {
          const envelope = Math.exp(-zeta * omega0 * t);
          position =
            this.#toValue -
            envelope * (((v0 + zeta * omega0 * x0) / omega1) * Math.sin(omega1 * t) + x0 * Math.cos(omega1 * t));
          velocity =
            zeta * omega0 * envelope * ((Math.sin(omega1 * t) * (v0 + zeta * omega0 * x0)) / omega1 + x0 * Math.cos(omega1 * t)) -
            envelope * (Math.cos(omega1 * t) * (v0 + zeta * omega0 * x0) - omega1 * x0 * Math.sin(omega1 * t));
        } else {
          const envelope = Math.exp(-omega0 * t);
          position = this.#toValue - envelope * (x0 + (v0 + omega0 * x0) * t);
          velocity = envelope * (v0 * (t * omega0 - 1) + t * x0 * (omega0 * omega0));
        }
        const overshooting =
          this.#overshootClamping &&
          k !== 0 &&
          (fromValue < this.#toValue ? position > this.#toValue : position < this.#toValue);
        const resting =
          Math.abs(velocity) <= this.#restSpeed && (k === 0 || Math.abs(this.#toValue - position) <= this.#restDisplacement);
        if (overshooting || resting) {
          onUpdate(this.#toValue);
          this.finish(true);
          return;
        }
        onUpdate(position);
        this.frame(step);
      };
      this.frame(step);
    });
  }
}

export interface DecayAnimationConfig {
  velocity: number | { x: number; y: number };
  deceleration?: number;
  delay?: number;
  isInteraction?: boolean;
  useNativeDriver: boolean;
}

class DecayAnimation extends Animation {
  #velocity: number;
  #deceleration: number;
  #delay: number;

  constructor(config: { velocity: number; deceleration?: number; delay?: number }) {
    super();
    this.#velocity = config.velocity;
    this.#deceleration = config.deceleration ?? 0.998;
    this.#delay = config.delay ?? 0;
  }

  start(fromValue: number, onUpdate: (value: number) => void, onEnd: EndCallback) {
    this.begin(onEnd, this.#delay, () => {
      const startTime = performance.now();
      let last = fromValue;
      const step = (now: number) => {
        const value =
          fromValue +
          (this.#velocity / (1 - this.#deceleration)) * (1 - Math.exp(-(1 - this.#deceleration) * (now - startTime)));
        onUpdate(value);
        if (Math.abs(last - value) < 0.1) {
          this.finish(true);
          return;
        }
        last = value;
        this.frame(step);
      };
      this.frame(step);
    });
  }
}

/** What `Animated.timing()` & co. return. */
export interface CompositeAnimation {
  start(callback?: EndCallback): void;
  stop(): void;
  reset(): void;
  _isUsingNativeDriver(): boolean;
}

type AnimatableValue = AnimatedValue | AnimatedValueXY | AnimatedColor;

const toNumber = (value: unknown): number => {
  if (typeof value === 'number') return value;
  if (value instanceof AnimatedNode) {
    warnOnce('Animated.toValue:node', 'Animating toward another Animated value uses its value at start time.');
    return Number(value.__getValue());
  }
  return Number(value);
};

function single(value: AnimatedValue, create: () => Animation, iterations = 1): CompositeAnimation {
  let iteration = 0;
  const run = (callback?: EndCallback) =>
    value.animate(create(), (result) => {
      iteration++;
      if (result.finished && (iterations === -1 || iteration < iterations)) {
        value.setValue(value._startingValue);
        run(callback);
      } else {
        iteration = 0;
        callback?.(result);
      }
    });
  return {
    start: (callback) => run(callback),
    stop: () => value.stopAnimation(),
    reset: () => value.resetAnimation(),
    _isUsingNativeDriver: () => false,
  };
}

function forEachChannel(
  value: AnimatedValueXY | AnimatedColor,
  toValue: unknown,
  make: (channel: AnimatedValue, target: number, key: string) => CompositeAnimation,
): CompositeAnimation {
  if (value instanceof AnimatedValueXY) {
    const target = toValue as { x: unknown; y: unknown };
    return parallel([make(value.x, toNumber(target.x), 'x'), make(value.y, toNumber(target.y), 'y')], { stopTogether: false });
  }
  const color = parseColor(toValue as string);
  return parallel(
    [
      make(value.r, color.r, 'r'),
      make(value.g, color.g, 'g'),
      make(value.b, color.b, 'b'),
      make(value.a, color.a, 'a'),
    ],
    { stopTogether: false },
  );
}

export function timing(value: AnimatableValue, config: TimingAnimationConfig): CompositeAnimation {
  if (value instanceof AnimatedValueXY || value instanceof AnimatedColor) {
    return forEachChannel(value, config.toValue, (channel, target) => timing(channel, { ...config, toValue: target }));
  }
  return single(value, () => new TimingAnimation({ ...config, toValue: toNumber(config.toValue) }), config.iterations ?? 1);
}

export function spring(value: AnimatableValue, config: SpringAnimationConfig): CompositeAnimation {
  if (value instanceof AnimatedValueXY || value instanceof AnimatedColor) {
    const velocity = config.velocity;
    return forEachChannel(value, config.toValue, (channel, target, key) =>
      spring(channel, {
        ...config,
        toValue: target,
        velocity: typeof velocity === 'object' ? (velocity as Record<string, number>)[key] ?? 0 : velocity,
      }),
    );
  }
  return single(
    value,
    () =>
      new SpringAnimation({
        ...config,
        toValue: toNumber(config.toValue),
        velocity: typeof config.velocity === 'number' ? config.velocity : 0,
      }),
  );
}

export function decay(value: AnimatableValue, config: DecayAnimationConfig): CompositeAnimation {
  if (value instanceof AnimatedValueXY) {
    const velocity = config.velocity as { x: number; y: number };
    return parallel(
      [
        decay(value.x, { ...config, velocity: velocity.x }),
        decay(value.y, { ...config, velocity: velocity.y }),
      ],
      { stopTogether: false },
    );
  }
  if (value instanceof AnimatedColor) {
    warnOnce('Animated.decay:color', 'Animated.decay is not supported for Animated.Color.');
    return parallel([]);
  }
  return single(value, () => new DecayAnimation({ ...config, velocity: config.velocity as number }));
}

/** Runs animations one after another; stops if one is interrupted. */
export function sequence(animations: CompositeAnimation[]): CompositeAnimation {
  let current = 0;
  return {
    start(callback) {
      const onComplete = (result: EndResult) => {
        if (!result.finished) {
          callback?.(result);
          return;
        }
        current++;
        if (current === animations.length) {
          current = 0;
          callback?.(result);
          return;
        }
        animations[current]!.start(onComplete);
      };
      if (animations.length === 0) callback?.({ finished: true });
      else animations[current]!.start(onComplete);
    },
    stop() {
      if (current < animations.length) animations[current]!.stop();
    },
    reset() {
      animations.forEach((animation, index) => {
        if (index <= current) animation.reset();
      });
      current = 0;
    },
    _isUsingNativeDriver: () => false,
  };
}

/** Runs animations at the same time. With `stopTogether` (default), stopping one stops all. */
export function parallel(animations: CompositeAnimation[], config?: { stopTogether?: boolean }): CompositeAnimation {
  let doneCount = 0;
  const hasEnded: boolean[] = [];
  const stopTogether = config?.stopTogether !== false;
  const result: CompositeAnimation = {
    start(callback) {
      if (animations.length === 0) {
        callback?.({ finished: true });
        return;
      }
      animations.forEach((animation, index) => {
        animation.start((endResult) => {
          hasEnded[index] = true;
          doneCount++;
          if (doneCount === animations.length) {
            doneCount = 0;
            callback?.(endResult);
            return;
          }
          if (!endResult.finished && stopTogether) result.stop();
        });
      });
    },
    stop() {
      animations.forEach((animation, index) => {
        if (!hasEnded[index]) animation.stop();
        hasEnded[index] = true;
      });
    },
    reset() {
      animations.forEach((animation, index) => {
        animation.reset();
        hasEnded[index] = false;
      });
      doneCount = 0;
    },
    _isUsingNativeDriver: () => false,
  };
  return result;
}

/** Waits `time` milliseconds. */
export function delay(time: number): CompositeAnimation {
  return timing(new AnimatedValue(0), { toValue: 0, delay: time, duration: 0, useNativeDriver: false });
}

/** Starts animations in parallel, each `time` ms after the previous one. */
export function stagger(time: number, animations: CompositeAnimation[]): CompositeAnimation {
  return parallel(animations.map((animation, index) => sequence([delay(time * index), animation])));
}

/** Repeats an animation (`iterations: -1` loops forever). */
export function loop(
  animation: CompositeAnimation,
  { iterations = -1, resetBeforeIteration = true }: { iterations?: number; resetBeforeIteration?: boolean } = {},
): CompositeAnimation {
  let isFinished = false;
  let iterationsSoFar = 0;
  return {
    start(callback) {
      const restart = (result: EndResult = { finished: true }) => {
        if (isFinished || iterationsSoFar === iterations || !result.finished) {
          callback?.(result);
          return;
        }
        iterationsSoFar++;
        if (resetBeforeIteration) animation.reset();
        animation.start(restart);
      };
      if (iterations === 0) callback?.({ finished: true });
      else restart();
    },
    stop() {
      isFinished = true;
      animation.stop();
    },
    reset() {
      iterationsSoFar = 0;
      isFinished = false;
      animation.reset();
    },
    _isUsingNativeDriver: () => false,
  };
}

export type Mapping = { [key: string]: Mapping } | AnimatedValue | AnimatedValueXY;
export interface EventConfig<T = unknown> {
  listener?: (event: T) => void;
  useNativeDriver: boolean;
}

function applyMapping(mapping: unknown, value: unknown) {
  if (mapping instanceof AnimatedValue) {
    if (typeof value === 'number') mapping.setValue(value);
  } else if (mapping instanceof AnimatedValueXY) {
    if (value && typeof value === 'object') {
      applyMapping(mapping.x, (value as XY).x);
      applyMapping(mapping.y, (value as XY).y);
    }
  } else if (mapping && typeof mapping === 'object' && value && typeof value === 'object') {
    for (const key of Object.keys(mapping)) {
      applyMapping((mapping as Record<string, unknown>)[key], (value as Record<string, unknown>)[key]);
    }
  }
}
type XY = { x: number; y: number };

/** Maps event fields onto animated values, e.g. `onScroll={Animated.event([{nativeEvent: {contentOffset: {y}}}])}`. */
export function event<T = any>(argMapping: ReadonlyArray<Mapping | null>, config?: EventConfig<T>): (...args: any[]) => void {
  return (...args: any[]) => {
    argMapping.forEach((mapping, index) => applyMapping(mapping, args[index]));
    config?.listener?.(args[0] as T);
  };
}

export function forkEvent(
  existing: ((...args: any[]) => void) | null | undefined,
  listener: (...args: any[]) => void,
): (...args: any[]) => void {
  if (!existing) return listener;
  return (...args) => {
    existing(...args);
    listener(...args);
  };
}

export function unforkEvent(_event: unknown, _listener: unknown): void {}

export function attachNativeEvent(_viewRef: unknown, _eventName: string, _argMapping: unknown[]): { detach(): void } {
  return { detach() {} };
}
