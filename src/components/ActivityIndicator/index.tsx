import { useAnimation } from 'ink';
import { isUnicodeSupported } from '../../internal/terminal.js';
import { warnOnce } from '../../internal/warn.js';
import type { ColorValue, StyleProp, ViewStyle } from '../../style/types.js';
import { Text } from '../Text/index.js';
import { View, type ViewProps } from '../View/index.js';

const SMALL = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const LARGE = ['▰▱▱', '▰▰▱', '▰▰▰', '▱▰▰', '▱▱▰', '▱▱▱'];
const SMALL_ASCII = ['|', '/', '-', '\\'];
const LARGE_ASCII = ['[=  ]', '[ = ]', '[  =]', '[ = ]'];

export interface ActivityIndicatorProps extends ViewProps {
  /** Whether the spinner is spinning (default true). */
  animating?: boolean;
  color?: ColorValue;
  /** Hide the spinner (keeping its space) when not animating (default true). */
  hidesWhenStopped?: boolean;
  /** `small` is a one-cell braille spinner, `large` a wider one; numbers count as small. */
  size?: number | 'small' | 'large';
}

/** A spinner driven by Ink's shared animation timer. */
export function ActivityIndicator({
  animating = true,
  color,
  hidesWhenStopped = true,
  size = 'small',
  style,
  ...viewProps
}: ActivityIndicatorProps) {
  const unicode = isUnicodeSupported();
  const frames = size === 'large' ? (unicode ? LARGE : LARGE_ASCII) : unicode ? SMALL : SMALL_ASCII;
  const { frame } = useAnimation({ interval: 80, isActive: animating });
  const glyph = frames[frame % frames.length] ?? frames[0]!;
  const visible = animating || !hidesWhenStopped;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityState={{ busy: animating }}
      {...viewProps}
      style={[{ flexDirection: 'row', alignSelf: 'flex-start' }, style]}
      component="ActivityIndicator"
    >
      <Text style={{ color }}>{visible ? glyph : ' '.repeat(glyph.length)}</Text>
    </View>
  );
}

export interface ProgressBarAndroidProps extends ViewProps {
  styleAttr?: 'Horizontal' | 'Normal' | 'Small' | 'Large' | 'Inverse' | 'SmallInverse' | 'LargeInverse';
  indeterminate?: boolean;
  progress?: number;
  animating?: boolean;
  color?: ColorValue;
  style?: StyleProp<ViewStyle>;
}

/** Deprecated in React Native; renders a bar (`Horizontal`, determinate) or a spinner. */
export function ProgressBarAndroid({
  styleAttr = 'Normal',
  indeterminate = true,
  progress = 0,
  animating = true,
  color,
  style,
  ...viewProps
}: ProgressBarAndroidProps) {
  warnOnce(
    'ProgressBarAndroid',
    "ProgressBarAndroid has been extracted from react-native core; install '@react-native-community/progress-bar-android' in React Native apps.",
  );
  if (styleAttr === 'Horizontal' && !indeterminate) {
    const width = 20;
    const filled = Math.round(Math.min(1, Math.max(0, progress)) * width);
    const [full, empty] = isUnicodeSupported() ? ['█', '░'] : ['#', '-'];
    return (
      <View accessibilityRole="progressbar" {...viewProps} style={[{ flexDirection: 'row' }, style]}>
        <Text style={{ color }}>
          {full.repeat(filled)}
          {empty.repeat(width - filled)}
        </Text>
      </View>
    );
  }
  return (
    <ActivityIndicator
      {...viewProps}
      style={style}
      color={color}
      animating={animating}
      size={styleAttr.startsWith('Large') ? 'large' : 'small'}
    />
  );
}
