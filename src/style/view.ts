import {
  UNIT_CELL,
  isRowDirection,
  toCells,
  type Axis,
  type CellSize,
  type LengthKind,
} from '../internal/units.js';
import { warnOnce } from '../internal/warn.js';
import { resolveBorders, stripUndefined } from './borders.js';
import { blendColor, resolveColor } from './colors.js';
import { classifyUnhandled } from './support.js';
import type { ViewStyle } from './types.js';

/** Ink `<Box>` props (kept loose: values are validated here, Ink applies them). */
export type InkBoxProps = Record<string, unknown>;

export interface ResolvedViewStyle {
  box: InkBoxProps;
  /** opacity < 1: descendant text renders dimmed. */
  dim: boolean;
  /** opacity 0: content is hidden but keeps its space. */
  hidden: boolean;
}

export interface ViewStyleOptions {
  /** Component name used in warnings. */
  component: string;
  /** Defaults applied before the style (React Native's View defaults unless overridden). */
  defaults?: InkBoxProps;
  /** Keys handled elsewhere (e.g. text styles on a Text's box); skipped without warnings. */
  skipKeys?: ReadonlySet<string>;
  /** Override Unicode detection for border glyphs (tests). */
  unicode?: boolean;
  /** Layout units per cell (see `setCellSize`); lengths are converted to whole cells. */
  cellSize?: CellSize;
  /** The parent's flex direction: `flexBasis` is a length along the parent's main axis. */
  parentDirection?: string;
  /** The color behind the view (an Ink color), which translucent colors are mixed with. */
  background?: string;
}

/** React Native's View defaults. Ink's Box defaults to `row` and `flexShrink: 1`. */
export const VIEW_DEFAULTS: InkBoxProps = { flexDirection: 'column', flexGrow: 0, flexShrink: 0 };

const HANDLED = new Set([
  'width',
  'height',
  'minWidth',
  'maxWidth',
  'minHeight',
  'maxHeight',
  'aspectRatio',
  'flex',
  'flexGrow',
  'flexShrink',
  'flexBasis',
  'flexDirection',
  'flexWrap',
  'justifyContent',
  'alignItems',
  'alignSelf',
  'alignContent',
  'gap',
  'rowGap',
  'columnGap',
  'position',
  'display',
  'overflow',
  'backgroundColor',
  'opacity',
  'transform',
  'borderStyle',
]);
const HANDLED_PREFIXES = ['margin', 'padding', 'inset', 'border'];
const INSET_KEYS = new Set(['top', 'right', 'bottom', 'left', 'start', 'end']);

/** Text-only props a View silently ignores (shared style objects are common). */
const TEXT_ONLY = new Set([
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
  'resizeMode',
  'objectFit',
  'tintColor',
  'overlayColor',
]);

const ENUMS: Record<string, readonly string[]> = {
  flexDirection: ['row', 'column', 'row-reverse', 'column-reverse'],
  flexWrap: ['wrap', 'nowrap', 'wrap-reverse'],
  justifyContent: [
    'flex-start',
    'flex-end',
    'center',
    'space-between',
    'space-around',
    'space-evenly',
  ],
  alignItems: ['flex-start', 'flex-end', 'center', 'stretch', 'baseline'],
  alignSelf: ['auto', 'flex-start', 'flex-end', 'center', 'stretch', 'baseline'],
  alignContent: [
    'flex-start',
    'flex-end',
    'center',
    'stretch',
    'space-between',
    'space-around',
    'space-evenly',
  ],
  position: ['absolute', 'relative', 'static'],
};

const PERCENT = /^-?\d+(\.\d+)?%$/;

const isAnimated = (value: unknown): value is { __getValue(): unknown } =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { __getValue?: unknown }).__getValue === 'function';

/** Resolves `Animated` nodes that ended up in a plain style. */
export const unwrap = (value: unknown): unknown => (isAnimated(value) ? value.__getValue() : value);

interface DimensionRules {
  percent?: boolean;
  /** `keep`: pass 'auto' through (margins); `default`: drop silently (sizes); `invalid`: warn. */
  auto?: 'keep' | 'default' | 'invalid';
}

/** How a number converts to cells: the cell size, the axis it runs along and its kind. */
interface Scale {
  cell: CellSize;
  axis: Axis;
  kind: LengthKind;
}

function dimension(
  component: string,
  key: string,
  raw: unknown,
  rules: DimensionRules = { percent: true },
  scale?: Scale,
): number | string | undefined {
  const value = unwrap(raw);
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === 'number') {
    if (Number.isFinite(value)) {
      return scale ? toCells(value, scale.cell, scale.axis, scale.kind) : value;
    }
  } else if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === 'auto' && rules.auto !== 'invalid') {
      // `auto` is the default for sizes; margins accept it explicitly.
      return rules.auto === 'keep' ? 'auto' : undefined;
    }
    if (PERCENT.test(trimmed)) {
      if (rules.percent) {
        return trimmed;
      }
      warnOnce(
        `${component}:${key}:percent`,
        `${component} style "${key}" does not support percentages in terminals and was ignored.`,
      );
      return undefined;
    }
  }
  warnOnce(
    `${component}:${key}:invalid:${String(value)}`,
    `${component} style "${key}" has an invalid value (${JSON.stringify(value)}) and was ignored.`,
  );
  return undefined;
}

const firstDefined = (style: Record<string, unknown>, keys: readonly string[]): unknown => {
  for (const key of keys) {
    if (style[key] !== undefined && style[key] !== null) {
      return style[key];
    }
  }
  return undefined;
};

const SIDE_AXIS: Record<string, Axis> = { Top: 'y', Bottom: 'y', Left: 'x', Right: 'x' };

function resolveSides(
  style: Record<string, unknown>,
  prefix: 'margin' | 'padding',
  component: string,
  rules: DimensionRules,
  cell: CellSize,
): InkBoxProps {
  const p = prefix;
  const sides: Record<string, readonly string[]> = {
    Top: [`${p}BlockStart`, `${p}Top`, `${p}Block`, `${p}Vertical`, p],
    Bottom: [`${p}BlockEnd`, `${p}Bottom`, `${p}Block`, `${p}Vertical`, p],
    Left: [`${p}InlineStart`, `${p}Start`, `${p}Left`, `${p}Inline`, `${p}Horizontal`, p],
    Right: [`${p}InlineEnd`, `${p}End`, `${p}Right`, `${p}Inline`, `${p}Horizontal`, p],
  };
  const result: InkBoxProps = {};
  for (const [side, keys] of Object.entries(sides)) {
    const key = keys.find((k) => style[k] !== undefined && style[k] !== null);
    if (key) {
      result[`${p}${side}`] = dimension(component, key, style[key], rules, {
        cell,
        axis: SIDE_AXIS[side] ?? 'x',
        kind: 'space',
      });
    }
  }
  return result;
}

/**
 * A ratio of layout units, as a ratio of cells: a square of 16×16 units is 2 columns by 1 row
 * when a cell is 8×16, so width/height in cells is twice the given ratio.
 */
function parseAspectRatio(component: string, raw: unknown, cell: CellSize): number | undefined {
  const ratio = parseRatio(component, raw);
  return ratio === undefined ? undefined : (ratio * cell.height) / cell.width;
}

function parseRatio(component: string, raw: unknown): number | undefined {
  const value = unwrap(raw);
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === 'string') {
    const [a, b] = value.split('/').map((part) => Number(part.trim()));
    const ratio = b === undefined ? a : a !== undefined && b !== 0 ? a / b : NaN;
    if (ratio !== undefined && Number.isFinite(ratio) && ratio > 0) {
      return ratio;
    }
  }
  warnOnce(
    `${component}:aspectRatio:invalid`,
    `${component} style "aspectRatio" has an invalid value and was ignored.`,
  );
  return undefined;
}

function gap(
  component: string,
  key: string,
  raw: unknown,
  cell: CellSize = UNIT_CELL,
  axis: Axis = 'x',
): number | undefined {
  const value = unwrap(raw);
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return toCells(value, cell, axis, 'space');
  }
  warnOnce(
    `${component}:${key}:invalid`,
    `${component} style "${key}" must be a number of cells and was ignored.`,
  );
  return undefined;
}

const TRANSLATE_STRING = /translate(X|Y)?\(\s*(-?[\d.]+)(?:px)?\s*(?:,\s*(-?[\d.]+)(?:px)?\s*)?\)/g;

function resolveTranslate(
  component: string,
  raw: unknown,
  cell: CellSize,
): { x: number; y: number } {
  let x = 0;
  let y = 0;
  let ignored = false;
  if (typeof raw === 'string') {
    for (const match of raw.matchAll(TRANSLATE_STRING)) {
      const [, axis, first = '0', second] = match;
      if (axis === 'X') x += Number(first);
      else if (axis === 'Y') y += Number(first);
      else {
        x += Number(first);
        y += Number(second ?? 0);
      }
    }
    ignored = raw.replace(TRANSLATE_STRING, '').trim().length > 0;
  } else if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (!entry || typeof entry !== 'object') continue;
      for (const [op, rawValue] of Object.entries(entry as Record<string, unknown>)) {
        const value = unwrap(rawValue);
        if ((op === 'translateX' || op === 'translateY') && typeof value === 'number') {
          if (op === 'translateX') x += value;
          else y += value;
        } else {
          ignored = true;
        }
      }
    }
  }
  if (ignored) {
    warnOnce(
      `${component}:transform:ignored`,
      `${component} style "transform": only translateX/translateY are supported in terminals; other transforms were ignored.`,
    );
  }
  return { x: Math.round(x / cell.width), y: Math.round(y / cell.height) };
}

const shift = (
  box: InkBoxProps,
  start: 'left' | 'top',
  end: 'right' | 'bottom',
  delta: number,
  component: string,
) => {
  if (delta === 0) return;
  const startValue = box[start];
  const endValue = box[end];
  if (typeof startValue === 'number') box[start] = startValue + delta;
  else if (startValue === undefined && typeof endValue === 'number') box[end] = endValue - delta;
  else if (startValue === undefined && endValue === undefined) box[start] = delta;
  else
    warnOnce(
      `${component}:transform:percent`,
      `${component} style "transform": translate cannot be combined with percentage offsets and was ignored.`,
    );
};

/** Translates a flattened React Native view style into Ink `<Box>` props. */
export function resolveViewStyle(
  style: ViewStyle | undefined,
  options: ViewStyleOptions,
): ResolvedViewStyle {
  const { component, skipKeys } = options;
  const cell = options.cellSize ?? UNIT_CELL;
  const box: InkBoxProps = { ...(options.defaults ?? VIEW_DEFAULTS) };
  if (!style) {
    return { box, dim: false, hidden: false };
  }
  const s = style as Record<string, unknown>;

  for (const key of Object.keys(s)) {
    if (s[key] === undefined || skipKeys?.has(key) || TEXT_ONLY.has(key)) continue;
    if (classifyUnhandled(key) === 'ignored') {
      warnOnce(
        `${component}:${key}`,
        `${component} style "${key}" is not supported in terminals and was ignored.`,
      );
      continue;
    }
    if (
      HANDLED.has(key) ||
      INSET_KEYS.has(key) ||
      HANDLED_PREFIXES.some((prefix) => key.startsWith(prefix))
    ) {
      continue;
    }
    warnOnce(
      `${component}:${key}`,
      `${component} style "${key}" is not a known style property and was ignored.`,
    );
  }

  // Enumerated layout props.
  for (const [key, allowed] of Object.entries(ENUMS)) {
    const value = s[key];
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' && allowed.includes(value)) {
      box[key] = value;
    } else {
      warnOnce(
        `${component}:${key}:invalid`,
        `${component} style "${key}" has an invalid value (${String(value)}) and was ignored.`,
      );
    }
  }

  // flex shorthand, following Yoga's React Native (non-web) rules.
  const flex = unwrap(s.flex);
  if (typeof flex === 'number' && Number.isFinite(flex)) {
    if (flex > 0) Object.assign(box, { flexGrow: flex, flexShrink: 0, flexBasis: 0 });
    else if (flex === 0) Object.assign(box, { flexGrow: 0, flexShrink: 0 });
    else Object.assign(box, { flexGrow: 0, flexShrink: -flex });
  }
  for (const key of ['flexGrow', 'flexShrink'] as const) {
    const value = unwrap(s[key]);
    if (typeof value === 'number' && Number.isFinite(value)) box[key] = value;
  }
  if (s.flexBasis !== undefined) {
    const basis = dimension(component, 'flexBasis', s.flexBasis, undefined, {
      cell,
      axis: isRowDirection(options.parentDirection) ? 'x' : 'y',
      kind: 'size',
    });
    if (basis !== undefined) box.flexBasis = basis;
  }

  // Sizes.
  for (const key of ['width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight']) {
    if (s[key] !== undefined) {
      box[key] = dimension(component, key, s[key], undefined, {
        cell,
        axis: key.toLowerCase().endsWith('width') ? 'x' : 'y',
        kind: 'size',
      });
    }
  }
  if (s.aspectRatio !== undefined) {
    box.aspectRatio = parseAspectRatio(component, s.aspectRatio, cell);
  }
  // `gap` sets both gutters. Rows are spaced vertically and columns horizontally, so when a cell
  // isn't square the two convert differently and `gap` is split into both.
  if (s.gap !== undefined) {
    if (cell.width === cell.height) box.gap = gap(component, 'gap', s.gap, cell);
    else {
      box.rowGap = gap(component, 'gap', s.gap, cell, 'y');
      box.columnGap = gap(component, 'gap', s.gap, cell, 'x');
    }
  }
  if (s.rowGap !== undefined) box.rowGap = gap(component, 'rowGap', s.rowGap, cell, 'y');
  if (s.columnGap !== undefined) {
    box.columnGap = gap(component, 'columnGap', s.columnGap, cell, 'x');
  }

  // Margins, paddings and offsets.
  Object.assign(box, resolveSides(s, 'margin', component, { percent: true, auto: 'keep' }, cell));
  Object.assign(
    box,
    resolveSides(s, 'padding', component, { percent: true, auto: 'invalid' }, cell),
  );
  const insets: Record<string, readonly string[]> = {
    top: ['insetBlockStart', 'top', 'insetBlock', 'inset'],
    bottom: ['insetBlockEnd', 'bottom', 'insetBlock', 'inset'],
    left: ['insetInlineStart', 'start', 'left', 'insetInline', 'inset'],
    right: ['insetInlineEnd', 'end', 'right', 'insetInline', 'inset'],
  };
  for (const [edge, keys] of Object.entries(insets)) {
    const raw = firstDefined(s, keys);
    if (raw !== undefined) {
      box[edge] = dimension(component, edge, raw, undefined, {
        cell,
        axis: edge === 'top' || edge === 'bottom' ? 'y' : 'x',
        kind: 'space',
      });
    }
  }

  if (s.transform !== undefined && s.transform !== null) {
    const { x, y } = resolveTranslate(component, s.transform, cell);
    if (x !== 0 || y !== 0) {
      if (box.position !== 'absolute') box.position = 'relative';
      shift(box, 'left', 'right', x, component);
      shift(box, 'top', 'bottom', y, component);
    }
  }

  // Display and overflow.
  if (s.display !== undefined) {
    if (s.display === 'flex' || s.display === 'none') box.display = s.display;
    else
      warnOnce(
        `${component}:display:${String(s.display)}`,
        `${component} style display "${String(s.display)}" is not supported and was ignored.`,
      );
  }
  if (s.overflow !== undefined) {
    if (s.overflow === 'visible' || s.overflow === 'hidden') box.overflow = s.overflow;
    else if (s.overflow === 'scroll') box.overflow = 'hidden';
  }

  // Opacity.
  const opacity = unwrap(s.opacity);
  const hidden = typeof opacity === 'number' && opacity <= 0;
  const dim = typeof opacity === 'number' && opacity < 1;

  // Background.
  if (s.backgroundColor !== undefined && !hidden) {
    const resolved = resolveColor(unwrap(s.backgroundColor) as never);
    if (resolved === null) {
      warnOnce(
        `${component}:backgroundColor:${String(s.backgroundColor)}`,
        `${component} style "backgroundColor" has an invalid color (${String(s.backgroundColor)}) and was ignored.`,
      );
    } else if (resolved?.color) {
      box.backgroundColor = blendColor(resolved, options.background);
    }
  }

  Object.assign(
    box,
    resolveBorders(style, {
      component,
      dim,
      hidden,
      unicode: options.unicode,
      // A border is drawn over the view's own background.
      background: (box.backgroundColor as string | undefined) ?? options.background,
    }),
  );

  return { box: stripUndefined(box), dim, hidden };
}
