import { warnOnce } from '../internal/warn.js';
import { blendColor, resolveColor } from './colors.js';
import type { TextStyle, ViewStyle } from './types.js';
import { unwrap } from './view.js';

export type TextTransform = 'none' | 'uppercase' | 'lowercase' | 'capitalize';
export type TextAlign = 'left' | 'center' | 'right';

/** Props for Ink's `<Text>`. */
export interface InkTextProps {
  color?: string;
  backgroundColor?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  dimColor?: boolean;
  inverse?: boolean;
}

export interface ResolvedTextStyle {
  ink: InkTextProps;
  /** Glyph background; a top-level Text with a layout box moves it onto the box instead. */
  backgroundColor?: string;
  transform?: TextTransform;
  align?: TextAlign;
  /** Light font weight, translucent color or opacity < 1. */
  dim: boolean;
  /** Transparent color or opacity 0: the text keeps its space but is not drawn. */
  hidden: boolean;
}

/** Style props that belong to the text itself rather than to its layout box. */
export const TEXT_STYLE_KEYS: ReadonlySet<string> = new Set([
  'color',
  'fontFamily',
  'fontSize',
  'fontStyle',
  'fontWeight',
  'letterSpacing',
  'lineHeight',
  'textAlign',
  'textDecorationLine',
  'textDecorationStyle',
  'textDecorationColor',
  'textShadowColor',
  'textShadowOffset',
  'textShadowRadius',
  'textTransform',
  'userSelect',
  'fontVariant',
  'writingDirection',
  'textAlignVertical',
  'verticalAlign',
  'includeFontPadding',
  'opacity',
  'backgroundColor',
]);

const IGNORED_TEXT_KEYS = [
  'fontFamily',
  'fontSize',
  'lineHeight',
  'letterSpacing',
  'fontVariant',
  'includeFontPadding',
  'textDecorationStyle',
  'textDecorationColor',
  'textShadowColor',
  'textShadowOffset',
  'textShadowRadius',
  'userSelect',
  'writingDirection',
  'textAlignVertical',
  'verticalAlign',
] as const;

const BOLD_WEIGHTS = new Set(['bold', 'semibold', 'condensedBold', 'heavy', 'black']);
const LIGHT_WEIGHTS = new Set(['thin', 'ultralight', 'light']);

export function resolveFontWeight(weight: unknown): 'bold' | 'dim' | undefined {
  if (weight === undefined || weight === null) return undefined;
  if (typeof weight === 'string' && BOLD_WEIGHTS.has(weight)) return 'bold';
  if (typeof weight === 'string' && LIGHT_WEIGHTS.has(weight)) return 'dim';
  const numeric = typeof weight === 'number' ? weight : Number(weight);
  if (Number.isFinite(numeric)) {
    if (numeric >= 600) return 'bold';
    if (numeric <= 300) return 'dim';
  }
  return undefined;
}

/** Splits a flattened Text style into its text part and its layout (box) part. */
export function splitTextStyle(style: TextStyle | undefined): {
  text: TextStyle;
  layout: ViewStyle;
} {
  const text: Record<string, unknown> = {};
  const layout: Record<string, unknown> = {};
  if (style) {
    for (const [key, value] of Object.entries(style)) {
      (TEXT_STYLE_KEYS.has(key) ? text : layout)[key] = value;
    }
  }
  return { text: text as TextStyle, layout: layout as ViewStyle };
}

const colorProp = (component: string, key: string, raw: unknown) => {
  const resolved = resolveColor(unwrap(raw) as never);
  if (resolved === null) {
    warnOnce(
      `${component}:${key}:${String(raw)}`,
      `${component} style "${key}" has an invalid color (${String(raw)}) and was ignored.`,
    );
  }
  return resolved ?? undefined;
};

/** Translates the text part of a flattened React Native style into Ink `<Text>` props. */
/**
 * `behind` is the color behind the text (an Ink color), which translucent text and background
 * colors are mixed with.
 */
export function resolveTextStyle(
  style: TextStyle | undefined,
  component = 'Text',
  behind?: string,
): ResolvedTextStyle {
  const result: ResolvedTextStyle = { ink: {}, dim: false, hidden: false };
  if (!style) return result;

  for (const key of IGNORED_TEXT_KEYS) {
    if (style[key] !== undefined) {
      warnOnce(
        `${component}:${key}`,
        `${component} style "${key}" is not supported in terminals and was ignored.`,
      );
    }
  }

  const background = colorProp(component, 'backgroundColor', style.backgroundColor);
  const backgroundColor = background ? blendColor(background, behind) : undefined;
  if (backgroundColor) result.backgroundColor = backgroundColor;
  const color = colorProp(component, 'color', style.color);
  if (color) {
    if (color.alpha === 0) result.hidden = true;
    else result.ink.color = blendColor(color, backgroundColor ?? behind);
  }

  const weight = resolveFontWeight(style.fontWeight);
  if (weight === 'bold') result.ink.bold = true;
  if (weight === 'dim') result.dim = true;
  if (style.fontStyle === 'italic') result.ink.italic = true;

  const decoration = style.textDecorationLine;
  if (typeof decoration === 'string') {
    if (decoration.includes('underline')) result.ink.underline = true;
    if (decoration.includes('line-through')) result.ink.strikethrough = true;
  }

  if (style.textTransform !== undefined) {
    const value = style.textTransform;
    if (
      value === 'none' ||
      value === 'uppercase' ||
      value === 'lowercase' ||
      value === 'capitalize'
    ) {
      result.transform = value;
    }
  }

  if (style.textAlign === 'center' || style.textAlign === 'right' || style.textAlign === 'left') {
    result.align = style.textAlign;
  } else if (style.textAlign === 'justify' || style.textAlign === 'auto') {
    result.align = 'left';
  }

  const opacity = unwrap(style.opacity);
  if (typeof opacity === 'number') {
    if (opacity <= 0) result.hidden = true;
    else if (opacity <= 0.5) result.dim = true;
  }

  return result;
}

const capitalize = (text: string) =>
  text.replace(
    /(^|[^\p{L}\p{N}'])(\p{L})/gu,
    (_match, before: string, letter: string) => before + letter.toUpperCase(),
  );

/** Applies `textTransform` to a string. */
export function applyTextTransform(text: string, transform: TextTransform | undefined): string {
  switch (transform) {
    case 'uppercase':
      return text.toUpperCase();
    case 'lowercase':
      return text.toLowerCase();
    case 'capitalize':
      return capitalize(text);
    default:
      return text;
  }
}
