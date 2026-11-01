/**
 * Single source of truth for how each React Native style prop behaves in a terminal.
 * It drives development warnings and generates docs/compat.md (`npm run docs:compat`).
 */

export type SupportLevel = 'mapped' | 'approximated' | 'ignored';
export type StyleCategory = 'layout' | 'view' | 'text' | 'image';

export interface StyleSupport {
  readonly category: StyleCategory;
  readonly level: SupportLevel;
  readonly note: string;
}

const entries = (
  category: StyleCategory,
  level: SupportLevel,
  note: string,
  keys: readonly string[],
): Array<[string, StyleSupport]> => keys.map((key) => [key, { category, level, note }]);

const marginKeys = [
  'margin',
  'marginHorizontal',
  'marginVertical',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'marginStart',
  'marginEnd',
  'marginBlock',
  'marginBlockStart',
  'marginBlockEnd',
  'marginInline',
  'marginInlineStart',
  'marginInlineEnd',
];
const paddingKeys = marginKeys.map((key) => key.replace('margin', 'padding'));
const insetKeys = [
  'top',
  'right',
  'bottom',
  'left',
  'start',
  'end',
  'inset',
  'insetBlock',
  'insetBlockStart',
  'insetBlockEnd',
  'insetInline',
  'insetInlineStart',
  'insetInlineEnd',
];
const borderWidthKeys = [
  'borderWidth',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderStartWidth',
  'borderEndWidth',
];
const borderColorKeys = [
  'borderColor',
  'borderTopColor',
  'borderRightColor',
  'borderBottomColor',
  'borderLeftColor',
  'borderStartColor',
  'borderEndColor',
  'borderBlockColor',
  'borderBlockStartColor',
  'borderBlockEndColor',
];
export const BORDER_RADIUS_KEYS = [
  'borderRadius',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomLeftRadius',
  'borderBottomRightRadius',
  'borderTopStartRadius',
  'borderTopEndRadius',
  'borderBottomStartRadius',
  'borderBottomEndRadius',
  'borderStartStartRadius',
  'borderStartEndRadius',
  'borderEndStartRadius',
  'borderEndEndRadius',
];

export const STYLE_SUPPORT: Readonly<Record<string, StyleSupport>> = Object.fromEntries([
  // Layout
  ...entries('layout', 'mapped', 'Cells or a percentage of the parent', ['width', 'height']),
  ...entries('layout', 'mapped', 'Cells or a percentage of the parent', [
    'minWidth',
    'maxWidth',
    'minHeight',
    'maxHeight',
  ]),
  ...entries('layout', 'mapped', "A number or an 'a/b' ratio string", ['aspectRatio']),
  ...entries(
    'layout',
    'mapped',
    "Expanded like React Native's Yoga: flex > 0 grows from a 0 basis",
    ['flex'],
  ),
  ...entries('layout', 'mapped', 'Same as React Native', [
    'flexGrow',
    'flexShrink',
    'flexBasis',
    'flexDirection',
    'flexWrap',
    'justifyContent',
    'alignItems',
    'alignSelf',
    'alignContent',
  ]),
  ...entries('layout', 'mapped', 'Cells', ['gap', 'rowGap', 'columnGap']),
  ...entries(
    'layout',
    'mapped',
    "Cells, percentages or 'auto'; a specific side beats its axis, which beats the shorthand",
    marginKeys,
  ),
  ...entries('layout', 'mapped', 'Cells or percentages; same precedence as margins', paddingKeys),
  ...entries('layout', 'mapped', "'absolute', 'relative' or 'static'", ['position']),
  ...entries(
    'layout',
    'mapped',
    'Offsets in cells or percentages; start/end map to left/right',
    insetKeys,
  ),
  ...entries('layout', 'mapped', "'flex' or 'none' ('contents' is ignored)", ['display']),
  ...entries('layout', 'mapped', "'visible' or 'hidden'; 'scroll' behaves as 'hidden'", [
    'overflow',
  ]),
  ...entries('layout', 'ignored', 'Paint order is always tree order', ['zIndex']),
  ...entries('layout', 'ignored', 'Layout is always left-to-right', ['direction']),
  ...entries('layout', 'ignored', 'Sizes always include padding and border', ['boxSizing']),
  // View visuals
  ...entries('view', 'mapped', 'Fills the box', ['backgroundColor']),
  ...entries(
    'view',
    'approximated',
    'A side is drawn when its width is above 0; borders are always 1 cell thick',
    borderWidthKeys,
  ),
  ...entries('view', 'mapped', 'Per-side border color', borderColorKeys),
  ...entries(
    'view',
    'approximated',
    "'solid', 'dashed' and 'dotted' pick a glyph set; Ink names ('double', 'round', 'bold', ...) are also accepted",
    ['borderStyle'],
  ),
  ...entries(
    'view',
    'approximated',
    'Any radius above 0 draws rounded corners',
    BORDER_RADIUS_KEYS,
  ),
  ...entries(
    'view',
    'approximated',
    'Below 1 dims descendant text and borders; 0 hides content but keeps its space',
    ['opacity'],
  ),
  ...entries(
    'view',
    'approximated',
    'translateX/translateY shift by whole cells without affecting layout; other transforms are ignored',
    ['transform'],
  ),
  ...entries('view', 'ignored', 'No terminal equivalent', [
    'shadowColor',
    'shadowOffset',
    'shadowOpacity',
    'shadowRadius',
    'elevation',
    'boxShadow',
    'filter',
    'backfaceVisibility',
    'borderCurve',
    'cursor',
    'pointerEvents',
    'isolation',
    'mixBlendMode',
    'outlineColor',
    'outlineOffset',
    'outlineStyle',
    'outlineWidth',
    'transformOrigin',
    'experimental_backgroundImage',
    'translateX',
    'translateY',
    'scaleX',
    'scaleY',
    'rotation',
  ]),
  // Text
  ...entries('text', 'mapped', 'Text color', ['color']),
  ...entries('text', 'mapped', "'italic' (if the terminal supports it)", ['fontStyle']),
  ...entries('text', 'approximated', 'Bold for bold/600+, dim for light/300 and below', [
    'fontWeight',
  ]),
  ...entries('text', 'mapped', "'underline', 'line-through' or both", ['textDecorationLine']),
  ...entries('text', 'mapped', 'uppercase / lowercase / capitalize; inherited by nested Text', [
    'textTransform',
  ]),
  ...entries(
    'text',
    'mapped',
    "left / center / right of the Text's box ('justify' behaves as 'left')",
    ['textAlign'],
  ),
  ...entries('text', 'ignored', 'Terminals use a single font size and family', [
    'fontFamily',
    'fontSize',
    'lineHeight',
    'letterSpacing',
    'fontVariant',
    'includeFontPadding',
  ]),
  ...entries('text', 'ignored', 'No terminal equivalent', [
    'textDecorationStyle',
    'textDecorationColor',
    'textShadowColor',
    'textShadowOffset',
    'textShadowRadius',
    'userSelect',
    'writingDirection',
    'textAlignVertical',
    'verticalAlign',
  ]),
  // Image
  ...entries('image', 'mapped', 'How the picture fits its box', ['resizeMode', 'objectFit']),
  ...entries('image', 'ignored', 'No terminal equivalent', ['overlayColor', 'tintColor']),
]);

export type WarnKind = 'ignored' | 'unknown';

/** Classifies a style prop that the resolvers did not handle. */
export function classifyUnhandled(key: string): WarnKind {
  return STYLE_SUPPORT[key]?.level === 'ignored' ? 'ignored' : 'unknown';
}
