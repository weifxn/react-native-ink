import { isUnicodeSupported } from '../internal/terminal.js';
import { warnOnce } from '../internal/warn.js';
import { resolveColor } from './colors.js';
import { BORDER_RADIUS_KEYS } from './support.js';
import type { ViewStyle } from './types.js';

/** Glyphs for one box style, in cli-boxes' shape (what Ink's `borderStyle` accepts). */
export interface BoxGlyphs {
  topLeft: string;
  top: string;
  topRight: string;
  right: string;
  bottomRight: string;
  bottom: string;
  bottomLeft: string;
  left: string;
}

const glyphs = (corners: string, horizontal: string, vertical: string): BoxGlyphs => {
  const [topLeft = ' ', topRight = ' ', bottomLeft = ' ', bottomRight = ' '] = [...corners];
  return {
    topLeft,
    top: horizontal,
    topRight,
    right: vertical,
    bottomRight,
    bottom: horizontal,
    bottomLeft,
    left: vertical,
  };
};

/** Ink's named box styles (from cli-boxes), so per-side tweaks can start from them. */
export const NAMED_BOX_STYLES: Readonly<Record<string, BoxGlyphs>> = {
  single: glyphs('┌┐└┘', '─', '│'),
  double: glyphs('╔╗╚╝', '═', '║'),
  round: glyphs('╭╮╰╯', '─', '│'),
  bold: glyphs('┏┓┗┛', '━', '┃'),
  singleDouble: glyphs('╓╖╙╜', '─', '║'),
  doubleSingle: glyphs('╒╕╘╛', '═', '│'),
  classic: glyphs('++++', '-', '|'),
};

const DASHED_H = '┄';
const DASHED_V = '┆';
const DOTTED_H = '┈';
const DOTTED_V = '┊';

const INVISIBLE = glyphs('    ', ' ', ' ');

type Side = 'top' | 'right' | 'bottom' | 'left';

export interface BorderOptions {
  component: string;
  /** opacity < 1: dim the border color. */
  dim?: boolean;
  /** opacity 0: draw the border with spaces so it keeps its space but is invisible. */
  hidden?: boolean;
  /** Override Unicode detection (tests). */
  unicode?: boolean;
}

const sideWidth = (style: ViewStyle, keys: ReadonlyArray<keyof ViewStyle>, component: string) => {
  for (const key of keys) {
    const value = style[key];
    if (value === undefined || value === null) {
      continue;
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      warnOnce(`${component}:${String(key)}:invalid`, `${component} style "${String(key)}" must be a number.`);
      return 0;
    }
    return value;
  }
  return 0;
};

const sideColor = (
  style: ViewStyle,
  keys: ReadonlyArray<keyof ViewStyle>,
  component: string,
): { color?: string; transparent: boolean } => {
  for (const key of keys) {
    const value = style[key];
    if (value === undefined || value === null) {
      continue;
    }
    const resolved = resolveColor(value as never);
    if (resolved === null) {
      warnOnce(
        `${component}:${String(key)}:color`,
        `${component} style "${String(key)}" has an invalid color (${String(value)}) and was ignored.`,
      );
      return { transparent: false };
    }
    if (resolved === undefined) {
      continue;
    }
    return resolved.alpha === 0
      ? { transparent: true }
      : { color: resolved.color, transparent: false };
  }
  return { transparent: false };
};

const hasRadius = (style: ViewStyle): boolean =>
  BORDER_RADIUS_KEYS.some((key) => {
    const value = (style as Record<string, unknown>)[key];
    return (typeof value === 'number' && value > 0) || (typeof value === 'string' && parseFloat(value) > 0);
  });

/**
 * Translates React Native border styles to Ink `<Box>` border props.
 * Returns an empty object when no side has a width above 0.
 */
export function resolveBorders(style: ViewStyle, options: BorderOptions): Record<string, unknown> {
  const { component } = options;
  const widths: Record<Side, number> = {
    top: sideWidth(style, ['borderTopWidth', 'borderWidth'], component),
    right: sideWidth(style, ['borderEndWidth', 'borderRightWidth', 'borderWidth'], component),
    bottom: sideWidth(style, ['borderBottomWidth', 'borderWidth'], component),
    left: sideWidth(style, ['borderStartWidth', 'borderLeftWidth', 'borderWidth'], component),
  };
  const visible = (side: Side) => widths[side] > 0;
  if (!visible('top') && !visible('right') && !visible('bottom') && !visible('left')) {
    return {};
  }

  const unicode = options.unicode ?? isUnicodeSupported();
  const rounded = hasRadius(style);
  const requested = style.borderStyle;
  let base: BoxGlyphs;
  if (!unicode) {
    base = NAMED_BOX_STYLES.classic!;
  } else if (requested && requested !== 'solid' && requested in NAMED_BOX_STYLES) {
    base = NAMED_BOX_STYLES[requested]!;
  } else if (requested === 'dashed' || requested === 'dotted') {
    const corners = rounded ? NAMED_BOX_STYLES.round! : NAMED_BOX_STYLES.single!;
    const [h, v] = requested === 'dashed' ? [DASHED_H, DASHED_V] : [DOTTED_H, DOTTED_V];
    base = { ...corners, top: h, bottom: h, left: v, right: v };
  } else if (rounded) {
    base = NAMED_BOX_STYLES.round!;
  } else if (Math.max(widths.top, widths.right, widths.bottom, widths.left) >= 2) {
    base = NAMED_BOX_STYLES.bold!;
  } else {
    base = NAMED_BOX_STYLES.single!;
  }

  const colors: Record<Side, { color?: string; transparent: boolean }> = {
    top: sideColor(style, ['borderTopColor', 'borderBlockStartColor', 'borderBlockColor', 'borderColor'], component),
    right: sideColor(style, ['borderEndColor', 'borderRightColor', 'borderColor'], component),
    bottom: sideColor(
      style,
      ['borderBottomColor', 'borderBlockEndColor', 'borderBlockColor', 'borderColor'],
      component,
    ),
    left: sideColor(style, ['borderStartColor', 'borderLeftColor', 'borderColor'], component),
  };

  let box: BoxGlyphs = base;
  if (options.hidden) {
    box = INVISIBLE;
  } else if (Object.values(colors).some((c) => c.transparent)) {
    // Transparent sides keep their space but draw spaces; corners follow the visible neighbour.
    const t = colors.top.transparent;
    const r = colors.right.transparent;
    const b = colors.bottom.transparent;
    const l = colors.left.transparent;
    const corner = (glyph: string, horizontalHidden: boolean, verticalHidden: boolean) =>
      horizontalHidden && verticalHidden
        ? ' '
        : horizontalHidden
          ? base.left
          : verticalHidden
            ? base.top
            : glyph;
    box = {
      top: t ? ' ' : base.top,
      bottom: b ? ' ' : base.bottom,
      left: l ? ' ' : base.left,
      right: r ? ' ' : base.right,
      topLeft: corner(base.topLeft, t, l),
      topRight: corner(base.topRight, t, r),
      bottomLeft: corner(base.bottomLeft, b, l),
      bottomRight: corner(base.bottomRight, b, r),
    };
  }

  const namedEntry = Object.entries(NAMED_BOX_STYLES).find(([, value]) => value === box);
  return stripUndefined({
    borderStyle: namedEntry ? namedEntry[0] : box,
    borderTop: visible('top'),
    borderRight: visible('right'),
    borderBottom: visible('bottom'),
    borderLeft: visible('left'),
    borderTopColor: colors.top.color,
    borderRightColor: colors.right.color,
    borderBottomColor: colors.bottom.color,
    borderLeftColor: colors.left.color,
    borderDimColor: options.dim && !options.hidden ? true : undefined,
  });
}

export function stripUndefined<T extends Record<string, unknown>>(object: T): T {
  for (const key of Object.keys(object)) {
    if (object[key] === undefined) {
      delete object[key];
    }
  }
  return object;
}
