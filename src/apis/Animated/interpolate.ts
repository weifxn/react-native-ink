import normalizeColor from '@react-native/normalize-colors';

export type ExtrapolateType = 'extend' | 'identity' | 'clamp';

export interface InterpolationConfigType<OutputT extends number | string = number | string> {
  inputRange: readonly number[];
  outputRange: readonly OutputT[];
  easing?: (input: number) => number;
  extrapolate?: ExtrapolateType;
  extrapolateLeft?: ExtrapolateType;
  extrapolateRight?: ExtrapolateType;
}

const linear = (t: number) => t;

function findRange(input: number, inputRange: readonly number[]): number {
  let i = 1;
  for (; i < inputRange.length - 1; ++i) {
    if (inputRange[i]! >= input) break;
  }
  return i - 1;
}

function interpolateNumber(
  input: number,
  inputMin: number,
  inputMax: number,
  outputMin: number,
  outputMax: number,
  easing: (t: number) => number,
  extrapolateLeft: ExtrapolateType,
  extrapolateRight: ExtrapolateType,
): number {
  let result = input;
  if (result < inputMin) {
    if (extrapolateLeft === 'identity') return result;
    if (extrapolateLeft === 'clamp') result = inputMin;
  }
  if (result > inputMax) {
    if (extrapolateRight === 'identity') return result;
    if (extrapolateRight === 'clamp') result = inputMax;
  }
  if (outputMin === outputMax) return outputMin;
  if (inputMin === inputMax) return input <= inputMin ? outputMin : outputMax;
  if (inputMin === -Infinity) result = -result;
  else if (inputMax === Infinity) result = result - inputMin;
  else result = (result - inputMin) / (inputMax - inputMin);
  result = easing(result);
  if (outputMin === -Infinity) result = -result;
  else if (outputMax === Infinity) result = result + outputMin;
  else result = result * (outputMax - outputMin) + outputMin;
  return result;
}

const NUMBER = /[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g;

function colorToRgba(value: string): string {
  const int = normalizeColor(value);
  if (int === null) return value;
  const rgba = int >>> 0;
  return `rgba(${(rgba >>> 24) & 255}, ${(rgba >>> 16) & 255}, ${(rgba >>> 8) & 255}, ${(rgba & 255) / 255})`;
}

function validate(config: InterpolationConfigType) {
  const { inputRange, outputRange } = config;
  if (inputRange.length < 2 || inputRange.length !== outputRange.length) {
    throw new Error('interpolate: inputRange and outputRange must have the same length (at least 2).');
  }
  for (let i = 1; i < inputRange.length; i++) {
    if (inputRange[i]! < inputRange[i - 1]!) throw new Error('interpolate: inputRange must be monotonically non-decreasing.');
  }
}

/** React Native's interpolation: numbers, colors, or strings containing numbers (`'0deg'`, `'50%'`). */
export function createInterpolation(config: InterpolationConfigType): (input: number) => number | string {
  validate(config);
  const { inputRange } = config;
  const easing = config.easing ?? linear;
  const left = config.extrapolateLeft ?? config.extrapolate ?? 'extend';
  const right = config.extrapolateRight ?? config.extrapolate ?? 'extend';

  if (typeof config.outputRange[0] === 'string') {
    const strings = (config.outputRange as readonly string[]).map(colorToRgba);
    const isColor = (config.outputRange as readonly string[]).every((value) => normalizeColor(value) !== null);
    const numbers = strings.map((value) => (value.match(NUMBER) ?? []).map(Number));
    const channels = numbers[0]!.map((_, index) =>
      createInterpolation({ ...config, outputRange: numbers.map((list) => list[index] ?? 0) }),
    );
    return (input) => {
      let index = 0;
      return strings[0]!.replace(NUMBER, () => {
        let value = channels[index]!(input) as number;
        if (isColor) value = index < 3 ? Math.round(value) : Math.round(value * 1000) / 1000;
        index++;
        return String(value);
      });
    };
  }

  const outputRange = config.outputRange as readonly number[];
  return (input) => {
    const range = findRange(input, inputRange);
    return interpolateNumber(
      input,
      inputRange[range]!,
      inputRange[range + 1]!,
      outputRange[range]!,
      outputRange[range + 1]!,
      easing,
      left,
      right,
    );
  };
}
