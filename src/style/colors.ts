import normalizeColor from '@react-native/normalize-colors';
import chalk from 'chalk';
import type { ColorValue, OpaqueColorValue } from './types.js';

/** The 8 ANSI colors (plus gray): rendered with the terminal's own palette. */
export const ANSI_COLOR_NAMES: ReadonlySet<string> = new Set([
  'black',
  'red',
  'green',
  'yellow',
  'blue',
  'magenta',
  'cyan',
  'white',
  'gray',
  'grey',
]);

/** Every color name Ink (chalk) understands, used for `PlatformColor`. */
const TERMINAL_PALETTE_NAMES: ReadonlySet<string> = new Set([
  ...ANSI_COLOR_NAMES,
  'blackBright',
  'redBright',
  'greenBright',
  'yellowBright',
  'blueBright',
  'magentaBright',
  'cyanBright',
  'whiteBright',
]);

const ANSI256 = /^ansi256\(\s*(\d{1,3})\s*\)$/;

export interface PlatformColorObject {
  readonly semantic: readonly string[];
}

export const isPlatformColor = (value: unknown): value is PlatformColorObject =>
  typeof value === 'object' &&
  value !== null &&
  Array.isArray((value as { semantic?: unknown }).semantic);

/** Creates an opaque color that refers to the terminal palette (`'redBright'`, `'ansi256(208)'`). */
export function createPlatformColor(names: readonly string[]): OpaqueColorValue {
  return { semantic: [...names] } as unknown as OpaqueColorValue;
}

export interface ResolvedColor {
  /** A color string Ink accepts (`'red'`, `'#rrggbb'`, `'ansi256(n)'`); undefined when transparent. */
  color: string | undefined;
  /** 0 (transparent) to 1 (opaque). */
  alpha: number;
}

const hex = (n: number) => n.toString(16).padStart(2, '0');

/**
 * Resolves any React Native color value. Returns `undefined` when unset and `null` when invalid.
 */
export function resolveColor(
  value: ColorValue | number | null | undefined,
): ResolvedColor | null | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (isPlatformColor(value)) {
    for (const name of value.semantic) {
      if (TERMINAL_PALETTE_NAMES.has(name)) {
        return { color: name, alpha: 1 };
      }
      const match = ANSI256.exec(name);
      if (match && Number(match[1]) <= 255) {
        return { color: `ansi256(${Number(match[1])})`, alpha: 1 };
      }
      const resolved = resolveColor(name);
      if (resolved) {
        return resolved;
      }
    }
    return null;
  }
  if (typeof value === 'string' && ANSI_COLOR_NAMES.has(value)) {
    return { color: value, alpha: 1 };
  }
  const int = normalizeColor(value);
  if (int === null || int === undefined) {
    return null;
  }
  const rgba = int >>> 0;
  const alpha = (rgba & 0xff) / 255;
  if (alpha === 0) {
    return { color: undefined, alpha: 0 };
  }
  const r = (rgba >>> 24) & 0xff;
  const g = (rgba >>> 16) & 0xff;
  const b = (rgba >>> 8) & 0xff;
  return { color: `#${hex(r)}${hex(g)}${hex(b)}`, alpha };
}

/**
 * React Native's `processColor`: returns the color as a 0xAARRGGBB integer (platform colors are
 * returned unchanged), `null`/`undefined` passthrough, and `null` for invalid colors.
 */
export function processColor(
  color?: ColorValue | number | null,
): number | OpaqueColorValue | null | undefined {
  if (color === undefined || color === null) {
    return color;
  }
  if (isPlatformColor(color)) {
    return color as OpaqueColorValue;
  }
  const int = normalizeColor(color);
  if (int === null || int === undefined) {
    return null;
  }
  return ((int << 24) | (int >>> 8)) >>> 0;
}

/**
 * Gives `text` a background in a color Ink accepts (`'#rrggbb'`, a palette name such as
 * `'redBright'`, `'ansi256(n)'`). Anything else is left unpainted, as Ink leaves it.
 */
export function paintBackground(text: string, color: string | undefined): string {
  if (!color || text === '') return text;
  const ansi256 = ANSI256.exec(color);
  if (ansi256) return chalk.bgAnsi256(Number(ansi256[1]))(text);
  if (/^#[\da-f]{6}$/i.test(color)) return chalk.bgHex(color)(text);
  const name = `bg${color[0]!.toUpperCase()}${color.slice(1)}`;
  const style = (chalk as unknown as Record<string, unknown>)[name];
  return typeof style === 'function' ? (style as (value: string) => string)(text) : text;
}

/**
 * Draws a box's border glyphs on its background — the box's own, else the one behind it — as
 * React Native paints a view's background under its border. Ink would leave them on the
 * terminal's default background.
 */
export function withBorderBackground<T extends Record<string, unknown>>(
  box: T,
  inherited: string | undefined,
): T {
  if (!box.borderStyle || box.borderBackgroundColor !== undefined) return box;
  const background = (box.backgroundColor as string | undefined) ?? inherited;
  return background ? { ...box, borderBackgroundColor: background } : box;
}
