/**
 * React Native's `Easing` functions. `bezier` follows the bezier-easing algorithm
 * (Gaëtan Renaudeau, MIT) that React Native also uses.
 */

export type EasingFunction = (value: number) => number;

const NEWTON_ITERATIONS = 4;
const NEWTON_MIN_SLOPE = 0.001;
const SUBDIVISION_PRECISION = 0.0000001;
const SUBDIVISION_MAX_ITERATIONS = 10;
const SPLINE_TABLE_SIZE = 11;
const SAMPLE_STEP = 1 / (SPLINE_TABLE_SIZE - 1);

const a = (a1: number, a2: number) => 1 - 3 * a2 + 3 * a1;
const b = (a1: number, a2: number) => 3 * a2 - 6 * a1;
const c = (a1: number) => 3 * a1;
const calcBezier = (t: number, a1: number, a2: number) => ((a(a1, a2) * t + b(a1, a2)) * t + c(a1)) * t;
const getSlope = (t: number, a1: number, a2: number) => 3 * a(a1, a2) * t * t + 2 * b(a1, a2) * t + c(a1);

function bezier(x1: number, y1: number, x2: number, y2: number): EasingFunction {
  if (!(x1 >= 0 && x1 <= 1 && x2 >= 0 && x2 <= 1)) {
    throw new Error('bezier x values must be in [0, 1] range');
  }
  const samples = new Float32Array(SPLINE_TABLE_SIZE);
  if (x1 !== y1 || x2 !== y2) {
    for (let i = 0; i < SPLINE_TABLE_SIZE; ++i) samples[i] = calcBezier(i * SAMPLE_STEP, x1, x2);
  }

  const binarySubdivide = (x: number, low: number, high: number) => {
    let current: number;
    let t: number;
    let i = 0;
    do {
      t = low + (high - low) / 2;
      current = calcBezier(t, x1, x2) - x;
      if (current > 0) high = t;
      else low = t;
    } while (Math.abs(current) > SUBDIVISION_PRECISION && ++i < SUBDIVISION_MAX_ITERATIONS);
    return t;
  };

  const newtonRaphson = (x: number, guess: number) => {
    let t = guess;
    for (let i = 0; i < NEWTON_ITERATIONS; ++i) {
      const slope = getSlope(t, x1, x2);
      if (slope === 0) return t;
      t -= (calcBezier(t, x1, x2) - x) / slope;
    }
    return t;
  };

  const getTForX = (x: number) => {
    let intervalStart = 0;
    let sample = 1;
    const last = SPLINE_TABLE_SIZE - 1;
    for (; sample !== last && samples[sample]! <= x; ++sample) intervalStart += SAMPLE_STEP;
    --sample;
    const dist = (x - samples[sample]!) / (samples[sample + 1]! - samples[sample]!);
    const guess = intervalStart + dist * SAMPLE_STEP;
    const slope = getSlope(guess, x1, x2);
    if (slope >= NEWTON_MIN_SLOPE) return newtonRaphson(x, guess);
    if (slope === 0) return guess;
    return binarySubdivide(x, intervalStart, intervalStart + SAMPLE_STEP);
  };

  return (x: number) => {
    if (x1 === y1 && x2 === y2) return x;
    if (x === 0 || x === 1) return x;
    return calcBezier(getTForX(x), y1, y2);
  };
}

const ease = bezier(0.42, 0, 1, 1);

export const Easing = {
  step0: (n: number): number => (n > 0 ? 1 : 0),
  step1: (n: number): number => (n >= 1 ? 1 : 0),
  linear: (t: number): number => t,
  ease: (t: number): number => ease(t),
  quad: (t: number): number => t * t,
  cubic: (t: number): number => t * t * t,
  poly: (n: number): EasingFunction => (t) => Math.pow(t, n),
  sin: (t: number): number => 1 - Math.cos((t * Math.PI) / 2),
  circle: (t: number): number => 1 - Math.sqrt(1 - t * t),
  exp: (t: number): number => Math.pow(2, 10 * (t - 1)),
  elastic(bounciness = 1): EasingFunction {
    const p = bounciness * Math.PI;
    return (t) => 1 - Math.pow(Math.cos((t * Math.PI) / 2), 3) * Math.cos(t * p);
  },
  back(s = 1.70158): EasingFunction {
    return (t) => t * t * ((s + 1) * t - s);
  },
  bounce(t: number): number {
    if (t < 1 / 2.75) return 7.5625 * t * t;
    if (t < 2 / 2.75) {
      const u = t - 1.5 / 2.75;
      return 7.5625 * u * u + 0.75;
    }
    if (t < 2.5 / 2.75) {
      const u = t - 2.25 / 2.75;
      return 7.5625 * u * u + 0.9375;
    }
    const u = t - 2.625 / 2.75;
    return 7.5625 * u * u + 0.984375;
  },
  bezier,
  in: (easing: EasingFunction): EasingFunction => easing,
  out: (easing: EasingFunction): EasingFunction => (t) => 1 - easing(1 - t),
  inOut: (easing: EasingFunction): EasingFunction => (t) =>
    t < 0.5 ? easing(t * 2) / 2 : 1 - easing((1 - t) * 2) / 2,
};
