import chalk from 'chalk';
import { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from 'ink-testing-library';
import { Animated, Easing, Text, View, useAnimatedValue } from '../src/index.js';
import { createInterpolation } from '../src/apis/Animated/interpolate.js';
import { renderInteractive, tick } from './helpers.js';

afterEach(() => {
  cleanup();
});

const run = (animation: Animated.CompositeAnimation) =>
  new Promise<Animated.EndResult>((resolve) => animation.start(resolve));

describe('Easing', () => {
  it('provides React Native easing curves', () => {
    expect(Easing.linear(0.3)).toBe(0.3);
    expect(Easing.quad(0.5)).toBe(0.25);
    expect(Easing.cubic(0.5)).toBe(0.125);
    expect(Easing.poly(4)(0.5)).toBe(0.0625);
    expect(Easing.bounce(1)).toBeCloseTo(1);
    expect(Easing.step0(0.1)).toBe(1);
    expect(Easing.step1(0.9)).toBe(0);
    expect(Easing.bezier(0.25, 0.1, 0.25, 1)(0.5)).toBeCloseTo(0.8024, 3);
    expect(Easing.out(Easing.quad)(0.5)).toBe(0.75);
    expect(Easing.inOut(Easing.quad)(0.25)).toBe(0.125);
    expect(Easing.inOut(Easing.quad)(0.75)).toBe(0.875);
    expect(Easing.ease(0)).toBe(0);
    expect(Easing.ease(1)).toBe(1);
  });
});

describe('interpolation', () => {
  it('interpolates numbers with extrapolation modes', () => {
    const extend = createInterpolation({ inputRange: [0, 1], outputRange: [0, 100] });
    expect(extend(0.5)).toBe(50);
    expect(extend(2)).toBe(200);
    const clamp = createInterpolation({ inputRange: [0, 1], outputRange: [0, 100], extrapolate: 'clamp' });
    expect(clamp(2)).toBe(100);
    expect(clamp(-1)).toBe(0);
    const identity = createInterpolation({ inputRange: [0, 1], outputRange: [0, 100], extrapolateRight: 'identity' });
    expect(identity(5)).toBe(5);
    const segments = createInterpolation({ inputRange: [0, 1, 2], outputRange: [0, 10, 0] });
    expect(segments(1.5)).toBe(5);
  });

  it('interpolates strings and colors', () => {
    expect(createInterpolation({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })(0.25)).toBe('90deg');
    expect(createInterpolation({ inputRange: [0, 1], outputRange: ['0%', '100%'] })(0.5)).toBe('50%');
    expect(createInterpolation({ inputRange: [0, 1], outputRange: ['red', 'blue'] })(0.5)).toBe(
      'rgba(128, 0, 128, 1)',
    );
  });

  it('rejects mismatched ranges', () => {
    expect(() => createInterpolation({ inputRange: [0, 1], outputRange: [0] })).toThrow();
    expect(() => createInterpolation({ inputRange: [1, 0], outputRange: [0, 1] })).toThrow();
  });
});

describe('Animated values', () => {
  it('sets values, offsets and notifies listeners', () => {
    const value = new Animated.Value(1);
    const listener = vi.fn();
    const id = value.addListener(listener);
    value.setValue(5);
    expect(listener).toHaveBeenLastCalledWith({ value: 5 });
    value.setOffset(10);
    expect(value.__getValue()).toBe(15);
    value.flattenOffset();
    expect(value.__getValue()).toBe(15);
    value.removeListener(id);
    value.setValue(0);
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('derives values with interpolate and arithmetic', () => {
    const a = new Animated.Value(2);
    const b = new Animated.Value(3);
    expect(Animated.add(a, b).__getValue()).toBe(5);
    expect(Animated.subtract(a, b).__getValue()).toBe(-1);
    expect(Animated.multiply(a, 10).__getValue()).toBe(20);
    expect(Animated.divide(a, b).__getValue()).toBeCloseTo(2 / 3);
    expect(Animated.modulo(new Animated.Value(-1), 3).__getValue()).toBe(2);
    const half = a.interpolate({ inputRange: [0, 4], outputRange: [0, 100] });
    expect(half.__getValue()).toBe(50);
    const listener = vi.fn();
    half.addListener(listener);
    a.setValue(4);
    expect(listener).toHaveBeenCalledWith({ value: 100 });
    const clamped = Animated.diffClamp(b, 0, 5);
    b.setValue(10);
    expect(clamped.__getValue()).toBe(5);
  });

  it('supports ValueXY and Color', () => {
    const position = new Animated.ValueXY({ x: 1, y: 2 });
    position.setValue({ x: 3, y: 4 });
    expect(position.__getValue()).toEqual({ x: 3, y: 4 });
    expect(position.getLayout().left).toBe(position.x);
    expect(position.getTranslateTransform()[1].translateY).toBe(position.y);
    const color = new Animated.Color('red');
    expect(color.__getValue()).toBe('rgba(255, 0, 0, 1)');
    color.setValue('#0000ff80');
    expect(color.__getValue()).toBe(`rgba(0, 0, 255, ${128 / 255})`);
  });
});

describe('animations', () => {
  it('runs timing animations to completion', async () => {
    const value = new Animated.Value(0);
    const result = await run(Animated.timing(value, { toValue: 10, duration: 60, easing: Easing.linear, useNativeDriver: false }));
    expect(result.finished).toBe(true);
    expect(value.__getValue()).toBe(10);
  });

  it('reports finished: false when stopped', async () => {
    const value = new Animated.Value(0);
    const animation = Animated.timing(value, { toValue: 10, duration: 1000, useNativeDriver: false });
    const pending = run(animation);
    await tick(50);
    animation.stop();
    const result = await pending;
    expect(result.finished).toBe(false);
    expect(value.__getValue()).toBeGreaterThan(0);
    expect(value.__getValue()).toBeLessThan(10);
  });

  it('settles springs and decays', async () => {
    const value = new Animated.Value(0);
    await run(Animated.spring(value, { toValue: 1, stiffness: 1000, damping: 100, useNativeDriver: false }));
    expect(value.__getValue()).toBe(1);
    const decaying = new Animated.Value(0);
    const result = await run(Animated.decay(decaying, { velocity: 0.5, deceleration: 0.9, useNativeDriver: false }));
    expect(result.finished).toBe(true);
    expect(decaying.__getValue()).toBeGreaterThan(0);
  });

  it('composes sequence, parallel, stagger, delay and loop', async () => {
    const a = new Animated.Value(0);
    const b = new Animated.Value(0);
    const order: string[] = [];
    a.addListener(({ value }) => value === 1 && order.push('a'));
    b.addListener(({ value }) => value === 1 && order.push('b'));
    await run(
      Animated.sequence([
        Animated.timing(a, { toValue: 1, duration: 20, useNativeDriver: false }),
        Animated.delay(10),
        Animated.timing(b, { toValue: 1, duration: 20, useNativeDriver: false }),
      ]),
    );
    expect(order).toEqual(['a', 'b']);
    await run(
      Animated.parallel([
        Animated.timing(a, { toValue: 2, duration: 20, useNativeDriver: false }),
        Animated.timing(b, { toValue: 2, duration: 30, useNativeDriver: false }),
      ]),
    );
    expect([a.__getValue(), b.__getValue()]).toEqual([2, 2]);
    await run(Animated.stagger(10, [Animated.timing(a, { toValue: 3, duration: 10, useNativeDriver: false })]));
    expect(a.__getValue()).toBe(3);
    let iterations = 0;
    const looped = new Animated.Value(0);
    looped.addListener(({ value }) => value === 1 && iterations++);
    await run(
      Animated.loop(Animated.timing(looped, { toValue: 1, duration: 10, useNativeDriver: false }), { iterations: 2 }),
    );
    expect(iterations).toBe(2);
  });

  it('animates ValueXY and Color channels', async () => {
    const position = new Animated.ValueXY();
    await run(Animated.timing(position, { toValue: { x: 5, y: -5 }, duration: 20, useNativeDriver: false }));
    expect(position.__getValue()).toEqual({ x: 5, y: -5 });
    const color = new Animated.Color('black');
    await run(Animated.timing(color, { toValue: 'white', duration: 20, useNativeDriver: false }));
    expect(color.__getValue()).toBe('rgba(255, 255, 255, 1)');
  });

  it('maps events onto values', () => {
    const scrollY = new Animated.Value(0);
    const listener = vi.fn();
    const handler = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
      useNativeDriver: false,
      listener,
    });
    handler({ nativeEvent: { contentOffset: { x: 0, y: 42 } } });
    expect(scrollY.__getValue()).toBe(42);
    expect(listener).toHaveBeenCalledOnce();
  });
});

describe('animated components', () => {
  it('re-renders when animated style values change', async () => {
    const width = new Animated.Value(4);
    const { lastFrame } = renderInteractive(
      <Animated.View style={{ width, borderWidth: 1 }}>
        <Text>x</Text>
      </Animated.View>,
    );
    await tick();
    expect(lastFrame()).toBe('┌──┐\n│x │\n└──┘');
    width.setValue(6);
    await tick();
    expect(lastFrame()).toBe('┌────┐\n│x   │\n└────┘');
  });

  it('animates opacity to dim and hide text', async () => {
    const previous = chalk.level;
    chalk.level = 3;
    try {
      const opacity = new Animated.Value(1);
      const { lastFrame } = renderInteractive(
        <Animated.Text style={{ opacity }}>
          fade
        </Animated.Text>,
      );
      await tick();
      expect(lastFrame()).toBe('fade');
      opacity.setValue(0.4);
      await tick();
      expect(lastFrame()).toBe('\u001b[2mfade\u001b[22m');
      opacity.setValue(0);
      await tick();
      expect(lastFrame()).toBe('');
    } finally {
      chalk.level = previous;
    }
  });

  it('drives a progress bar with a hook and interpolate', async () => {
    function Progress() {
      const progress = useAnimatedValue(0);
      useEffect(() => {
        Animated.timing(progress, { toValue: 1, duration: 60, useNativeDriver: false }).start();
      }, [progress]);
      const width = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
      return (
        <View style={{ width: 10 }}>
          <Animated.View style={{ width, height: 1, backgroundColor: 'blue' }} />
        </View>
      );
    }
    const previous = chalk.level;
    chalk.level = 3;
    try {
      const { lastFrame } = renderInteractive(<Progress />);
      await tick(200);
      expect(lastFrame()).toBe('\u001b[44m          \u001b[49m');
    } finally {
      chalk.level = previous;
    }
  });
});
