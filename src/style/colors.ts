import normalizeColor from '@react-native/normalize-colors';
import chalk from 'chalk';
import { detectColorScheme } from '../apis/Appearance.js';
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

type Rgb = readonly [number, number, number];

/** xterm's default palette: how most terminals draw the named ANSI colors. */
const PALETTE: readonly Rgb[] = [
  [0, 0, 0],
  [205, 0, 0],
  [0, 205, 0],
  [205, 205, 0],
  [0, 0, 238],
  [205, 0, 205],
  [0, 205, 205],
  [229, 229, 229],
  [127, 127, 127],
  [255, 0, 0],
  [0, 255, 0],
  [255, 255, 0],
  [92, 92, 255],
  [255, 0, 255],
  [0, 255, 255],
  [255, 255, 255],
];
const PALETTE_INDEX: Readonly<Record<string, number>> = {
  black: 0,
  red: 1,
  green: 2,
  yellow: 3,
  blue: 4,
  magenta: 5,
  cyan: 6,
  white: 7,
  gray: 8,
  grey: 8,
  blackBright: 8,
  redBright: 9,
  greenBright: 10,
  yellowBright: 11,
  blueBright: 12,
  magentaBright: 13,
  cyanBright: 14,
  whiteBright: 15,
};
const CUBE = [0, 95, 135, 175, 215, 255];

/** The RGB of a color Ink accepts (`'#rrggbb'`, an ANSI name, `'ansi256(n)'`), if known. */
function rgbOf(color: string): Rgb | undefined {
  if (/^#[0-9a-f]{6}$/i.test(color)) {
    const value = Number.parseInt(color.slice(1), 16);
    return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
  }
  const named = PALETTE_INDEX[color];
  if (named !== undefined) return PALETTE[named];
  const match = ANSI256.exec(color);
  if (!match) return undefined;
  const index = Number(match[1]);
  if (index < 16) return PALETTE[index];
  if (index < 232) {
    const cube = index - 16;
    return [CUBE[Math.floor(cube / 36)]!, CUBE[Math.floor(cube / 6) % 6]!, CUBE[cube % 6]!];
  }
  const gray = 8 + (index - 232) * 10;
  return [gray, gray, gray];
}

/** The terminal's own background, which few terminals report: black, or white in a light one. */
let terminalBackground: Rgb | undefined;
const terminalRgb = (): Rgb =>
  (terminalBackground ??= detectColorScheme() === 'light' ? [255, 255, 255] : [0, 0, 0]);

/**
 * A resolved color as an opaque one Ink can draw: a translucent color is mixed with the color
 * behind it (`behind`; the terminal's own background when that's unknown), since a terminal cell
 * has one color. Opaque colors come back as they are; a fully transparent one as undefined.
 */
export function blendColor(color: ResolvedColor, behind?: string): string | undefined {
  if (color.color === undefined || color.alpha >= 1) return color.color;
  const front = rgbOf(color.color);
  if (!front) return color.color;
  const back = (behind === undefined ? undefined : rgbOf(behind)) ?? terminalRgb();
  const mix = (channel: number) =>
    hex(Math.round(front[channel]! * color.alpha + back[channel]! * (1 - color.alpha)));
  return `#${mix(0)}${mix(1)}${mix(2)}`;
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
