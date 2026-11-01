import { useRef } from 'react';
import { Image } from '../../components/Image/index.js';
import { FlatList, SectionList } from '../../components/Lists/index.js';
import { ScrollView } from '../../components/ScrollView/index.js';
import { Text } from '../../components/Text/index.js';
import { View } from '../../components/View/index.js';
import {
  attachNativeEvent,
  decay,
  delay,
  event,
  forkEvent,
  loop,
  parallel,
  sequence,
  spring,
  stagger,
  timing,
  unforkEvent,
  type CompositeAnimation as CompositeAnimationType,
  type DecayAnimationConfig as DecayConfig,
  type EndCallback as EndCallbackType,
  type EndResult as EndResultType,
  type EventConfig as EventConfigType,
  type Mapping as MappingType,
  type SpringAnimationConfig as SpringConfig,
  type TimingAnimationConfig as TimingConfig,
} from './animations.js';
import {
  createAnimatedComponent,
  type AnimatedComponent as AnimatedComponentType,
  type AnimatedProps as AnimatedPropsType,
  type WithAnimatedValue as WithAnimatedValueType,
} from './createAnimatedComponent.js';
import type {
  ExtrapolateType as ExtrapolateTypeT,
  InterpolationConfigType as InterpolationConfig,
} from './interpolate.js';
import {
  AnimatedColor,
  AnimatedDiffClamp,
  AnimatedInterpolation as AnimatedInterpolationClass,
  AnimatedNode,
  AnimatedOperation,
  AnimatedValue,
  AnimatedValueXY,
} from './nodes.js';

type Operand = AnimatedNode | number;

/**
 * React Native's `Animated`, driven from JavaScript (there is no native driver). Animated
 * opacity dims text, layout props (width, margins, offsets) animate layout, translate transforms
 * shift by cells and colors animate in truecolor terminals.
 */
export const Animated = {
  Value: AnimatedValue,
  ValueXY: AnimatedValueXY,
  Color: AnimatedColor,
  Interpolation: AnimatedInterpolationClass,
  Node: AnimatedNode,
  timing,
  spring,
  decay,
  sequence,
  parallel,
  stagger,
  delay,
  loop,
  event,
  forkEvent,
  unforkEvent,
  attachNativeEvent,
  createAnimatedComponent,
  add: (a: Operand, b: Operand) => new AnimatedOperation(a, b, (x, y) => x + y),
  subtract: (a: Operand, b: Operand) => new AnimatedOperation(a, b, (x, y) => x - y),
  multiply: (a: Operand, b: Operand) => new AnimatedOperation(a, b, (x, y) => x * y),
  divide: (a: Operand, b: Operand) =>
    new AnimatedOperation(a, b, (x, y) => {
      if (y === 0) {
        console.error('Animated.divide: detected division by zero');
        return 0;
      }
      return x / y;
    }),
  modulo: (a: AnimatedNode, modulus: number) =>
    new AnimatedOperation(a, modulus, (x, m) => ((x % m) + m) % m),
  diffClamp: (a: AnimatedNode, min: number, max: number) => new AnimatedDiffClamp(a, min, max),
  View: createAnimatedComponent(View),
  Text: createAnimatedComponent(Text),
  Image: createAnimatedComponent(Image),
  ScrollView: createAnimatedComponent(ScrollView),
  FlatList: createAnimatedComponent(FlatList),
  SectionList: createAnimatedComponent(SectionList),
};

/** Types available as `Animated.Value`, `Animated.CompositeAnimation`, ... like React Native. */
// eslint-disable-next-line @typescript-eslint/no-namespace
export declare namespace Animated {
  type Value = AnimatedValue;
  type ValueXY = AnimatedValueXY;
  type Color = AnimatedColor;
  type AnimatedInterpolation<OutputT extends number | string = number | string> =
    AnimatedInterpolationClass<OutputT>;
  type Interpolation<OutputT extends number | string = number | string> =
    AnimatedInterpolationClass<OutputT>;
  type Node = AnimatedNode;
  type CompositeAnimation = CompositeAnimationType;
  type EndResult = EndResultType;
  type EndCallback = EndCallbackType;
  type TimingAnimationConfig = TimingConfig;
  type SpringAnimationConfig = SpringConfig;
  type DecayAnimationConfig = DecayConfig;
  type InterpolationConfigType = InterpolationConfig;
  type ExtrapolateType = ExtrapolateTypeT;
  type Mapping = MappingType;
  type EventConfig<T> = EventConfigType<T>;
  type WithAnimatedValue<T> = WithAnimatedValueType<T>;
  type AnimatedProps<T> = AnimatedPropsType<T>;
  type AnimatedComponent<T> = AnimatedComponentType<T>;
}

/** An `Animated.Value` that lives as long as the component. */
export function useAnimatedValue(
  initialValue: number,
  config?: { useNativeDriver?: boolean },
): AnimatedValue {
  const ref = useRef<AnimatedValue | null>(null);
  ref.current ??= new AnimatedValue(initialValue, config);
  return ref.current;
}

export function useAnimatedValueXY(
  initialValue?: { x: number; y: number },
  config?: { useNativeDriver?: boolean },
): AnimatedValueXY {
  const ref = useRef<AnimatedValueXY | null>(null);
  ref.current ??= new AnimatedValueXY(initialValue, config);
  return ref.current;
}

export function useAnimatedColor(initialValue?: string): AnimatedColor {
  const ref = useRef<AnimatedColor | null>(null);
  ref.current ??= new AnimatedColor(initialValue);
  return ref.current;
}

export { requestFrame } from './animations.js';
