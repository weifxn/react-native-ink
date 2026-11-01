/**
 * Style types modeled on React Native's `StyleSheetTypes` (MIT, Meta Platforms, Inc.),
 * so that code written against React Native type-checks unchanged. Props that have no
 * terminal equivalent stay in the types and are ignored at runtime (with a dev warning).
 */

declare const opaqueColorBrand: unique symbol;

/** A platform color created with `PlatformColor()` or `DynamicColorIOS()`. */
export type OpaqueColorValue = { readonly [opaqueColorBrand]: 'Color' };
export type ColorValue = string | OpaqueColorValue;

/** Structural stand-in for animated values so styles accept `Animated.Value`s. */
export interface AnimatedNodeLike {
  __getValue(): unknown;
}

/** Cells (numbers), percentages of the parent, or `'auto'`. */
export type DimensionValue = number | 'auto' | `${number}%` | AnimatedNodeLike | null;

type FlexAlignType = 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';

/**
 * Border glyph sets. `solid`, `dotted` and `dashed` come from React Native; the rest are
 * terminal extensions that pick one of Ink's box styles directly.
 */
export type BorderStyle =
  | 'solid'
  | 'dotted'
  | 'dashed'
  | 'single'
  | 'double'
  | 'round'
  | 'bold'
  | 'singleDouble'
  | 'doubleSingle'
  | 'classic';

export interface FlexStyle {
  alignContent?:
    | 'flex-start'
    | 'flex-end'
    | 'center'
    | 'stretch'
    | 'space-between'
    | 'space-around'
    | 'space-evenly';
  alignItems?: FlexAlignType;
  alignSelf?: 'auto' | FlexAlignType;
  aspectRatio?: number | string;
  borderBottomWidth?: number;
  borderEndWidth?: number;
  borderLeftWidth?: number;
  borderRightWidth?: number;
  borderStartWidth?: number;
  borderTopWidth?: number;
  borderWidth?: number;
  bottom?: DimensionValue;
  boxSizing?: 'border-box' | 'content-box';
  display?: 'none' | 'flex' | 'contents';
  end?: DimensionValue;
  flex?: number;
  flexBasis?: DimensionValue;
  flexDirection?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
  rowGap?: number | string;
  gap?: number | string;
  columnGap?: number | string;
  flexGrow?: number;
  flexShrink?: number;
  flexWrap?: 'wrap' | 'nowrap' | 'wrap-reverse';
  height?: DimensionValue;
  justifyContent?:
    | 'flex-start'
    | 'flex-end'
    | 'center'
    | 'space-between'
    | 'space-around'
    | 'space-evenly';
  left?: DimensionValue;
  margin?: DimensionValue;
  marginBlock?: DimensionValue;
  marginBlockEnd?: DimensionValue;
  marginBlockStart?: DimensionValue;
  marginBottom?: DimensionValue;
  marginEnd?: DimensionValue;
  marginHorizontal?: DimensionValue;
  marginInline?: DimensionValue;
  marginInlineEnd?: DimensionValue;
  marginInlineStart?: DimensionValue;
  marginLeft?: DimensionValue;
  marginRight?: DimensionValue;
  marginStart?: DimensionValue;
  marginTop?: DimensionValue;
  marginVertical?: DimensionValue;
  maxHeight?: DimensionValue;
  maxWidth?: DimensionValue;
  minHeight?: DimensionValue;
  minWidth?: DimensionValue;
  overflow?: 'visible' | 'hidden' | 'scroll';
  padding?: DimensionValue;
  paddingBlock?: DimensionValue;
  paddingBlockEnd?: DimensionValue;
  paddingBlockStart?: DimensionValue;
  paddingBottom?: DimensionValue;
  paddingEnd?: DimensionValue;
  paddingHorizontal?: DimensionValue;
  paddingInline?: DimensionValue;
  paddingInlineEnd?: DimensionValue;
  paddingInlineStart?: DimensionValue;
  paddingLeft?: DimensionValue;
  paddingRight?: DimensionValue;
  paddingStart?: DimensionValue;
  paddingTop?: DimensionValue;
  paddingVertical?: DimensionValue;
  position?: 'absolute' | 'relative' | 'static';
  right?: DimensionValue;
  start?: DimensionValue;
  top?: DimensionValue;
  inset?: DimensionValue;
  insetBlock?: DimensionValue;
  insetBlockEnd?: DimensionValue;
  insetBlockStart?: DimensionValue;
  insetInline?: DimensionValue;
  insetInlineEnd?: DimensionValue;
  insetInlineStart?: DimensionValue;
  width?: DimensionValue;
  /** @remarks Ignored in terminals: paint order is tree order. */
  zIndex?: number;
  /** @remarks Ignored in terminals: layout is always left-to-right. */
  direction?: 'inherit' | 'ltr' | 'rtl';
}

/** @remarks Shadows are ignored in terminals. */
export interface ShadowStyleIOS {
  shadowColor?: ColorValue;
  shadowOffset?: { width: number; height: number };
  shadowOpacity?: number | AnimatedNodeLike;
  shadowRadius?: number;
}

type TransformEntry =
  | { perspective: number | AnimatedNodeLike }
  | { rotate: string | AnimatedNodeLike }
  | { rotateX: string | AnimatedNodeLike }
  | { rotateY: string | AnimatedNodeLike }
  | { rotateZ: string | AnimatedNodeLike }
  | { scale: number | AnimatedNodeLike }
  | { scaleX: number | AnimatedNodeLike }
  | { scaleY: number | AnimatedNodeLike }
  | { translateX: number | `${number}%` | AnimatedNodeLike }
  | { translateY: number | `${number}%` | AnimatedNodeLike }
  | { skewX: string | AnimatedNodeLike }
  | { skewY: string | AnimatedNodeLike }
  | { matrix: number[] };

export interface TransformsStyle {
  /**
   * `translateX`/`translateY` shift the element by whole cells without affecting layout.
   * Rotation, scale, skew and perspective are ignored in terminals.
   */
  transform?: readonly TransformEntry[] | string;
  /** @remarks Ignored in terminals. */
  transformOrigin?: Array<string | number> | string;
}

export type CursorValue = 'auto' | 'pointer';

export interface ViewStyle extends FlexStyle, ShadowStyleIOS, TransformsStyle {
  /** @remarks Ignored in terminals. */
  backfaceVisibility?: 'visible' | 'hidden';
  backgroundColor?: ColorValue;
  borderBlockColor?: ColorValue;
  borderBlockEndColor?: ColorValue;
  borderBlockStartColor?: ColorValue;
  borderBottomColor?: ColorValue;
  borderBottomEndRadius?: number | string;
  borderBottomLeftRadius?: number | string;
  borderBottomRightRadius?: number | string;
  borderBottomStartRadius?: number | string;
  borderColor?: ColorValue;
  /** @remarks Ignored in terminals. */
  borderCurve?: 'circular' | 'continuous';
  borderEndColor?: ColorValue;
  borderEndEndRadius?: number | string;
  borderEndStartRadius?: number | string;
  borderLeftColor?: ColorValue;
  /** Any radius above 0 draws rounded corners. */
  borderRadius?: number | string;
  borderRightColor?: ColorValue;
  borderStartColor?: ColorValue;
  borderStartEndRadius?: number | string;
  borderStartStartRadius?: number | string;
  borderStyle?: BorderStyle;
  borderTopColor?: ColorValue;
  borderTopEndRadius?: number | string;
  borderTopLeftRadius?: number | string;
  borderTopRightRadius?: number | string;
  borderTopStartRadius?: number | string;
  /** @remarks Ignored in terminals. */
  boxShadow?: string | readonly object[];
  /** @remarks Ignored in terminals. */
  cursor?: CursorValue;
  /** @remarks Ignored in terminals. */
  elevation?: number;
  /** @remarks Ignored in terminals. */
  filter?: string | readonly object[];
  /** @remarks Ignored in terminals. */
  isolation?: 'auto' | 'isolate';
  /** @remarks Ignored in terminals. */
  mixBlendMode?: string;
  /** Below 1 dims descendant text; 0 hides the content but keeps its space. */
  opacity?: number | AnimatedNodeLike;
  /** @remarks Ignored in terminals. */
  outlineColor?: ColorValue;
  /** @remarks Ignored in terminals. */
  outlineOffset?: number;
  /** @remarks Ignored in terminals. */
  outlineStyle?: 'solid' | 'dotted' | 'dashed';
  /** @remarks Ignored in terminals. */
  outlineWidth?: number;
  /** @remarks Ignored in terminals. */
  pointerEvents?: 'box-none' | 'none' | 'box-only' | 'auto';
  /** @remarks Ignored in terminals. */
  experimental_backgroundImage?: string | readonly object[];
}

export type FontWeight =
  | 'normal'
  | 'bold'
  | '100'
  | '200'
  | '300'
  | '400'
  | '500'
  | '600'
  | '700'
  | '800'
  | '900'
  | 100
  | 200
  | 300
  | 400
  | 500
  | 600
  | 700
  | 800
  | 900
  | 'ultralight'
  | 'thin'
  | 'light'
  | 'medium'
  | 'regular'
  | 'semibold'
  | 'condensedBold'
  | 'condensed'
  | 'heavy'
  | 'black';

export interface TextStyle extends ViewStyle {
  color?: ColorValue;
  /** @remarks Ignored in terminals. */
  fontFamily?: string;
  /** @remarks Ignored in terminals. */
  fontSize?: number;
  fontStyle?: 'normal' | 'italic';
  /** Bold for `bold`/600+, dim for `light`/300 and below. */
  fontWeight?: FontWeight;
  /** @remarks Ignored in terminals. */
  letterSpacing?: number;
  /** @remarks Ignored in terminals. */
  lineHeight?: number;
  textAlign?: 'auto' | 'left' | 'right' | 'center' | 'justify';
  textDecorationLine?: 'none' | 'underline' | 'line-through' | 'underline line-through';
  /** @remarks Ignored in terminals. */
  textDecorationStyle?: 'solid' | 'double' | 'dotted' | 'dashed';
  /** @remarks Ignored in terminals. */
  textDecorationColor?: ColorValue;
  /** @remarks Ignored in terminals. */
  textShadowColor?: ColorValue;
  /** @remarks Ignored in terminals. */
  textShadowOffset?: { width: number; height: number };
  /** @remarks Ignored in terminals. */
  textShadowRadius?: number;
  textTransform?: 'none' | 'capitalize' | 'uppercase' | 'lowercase';
  /** @remarks Ignored in terminals. */
  userSelect?: 'auto' | 'none' | 'text' | 'contain' | 'all';
  /** @remarks Ignored in terminals. */
  fontVariant?: readonly string[];
  /** @remarks Ignored in terminals. */
  writingDirection?: 'auto' | 'ltr' | 'rtl';
  /** @remarks Ignored in terminals. */
  textAlignVertical?: 'auto' | 'top' | 'bottom' | 'center';
  /** @remarks Ignored in terminals. */
  verticalAlign?: 'auto' | 'top' | 'bottom' | 'middle';
  /** @remarks Ignored in terminals. */
  includeFontPadding?: boolean;
}

export interface ImageStyle extends FlexStyle, ShadowStyleIOS, TransformsStyle {
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center' | 'none';
  objectFit?: 'cover' | 'contain' | 'fill' | 'scale-down' | 'none';
  backfaceVisibility?: 'visible' | 'hidden';
  backgroundColor?: ColorValue;
  borderColor?: ColorValue;
  borderRadius?: number | string;
  borderBottomLeftRadius?: number | string;
  borderBottomRightRadius?: number | string;
  borderTopLeftRadius?: number | string;
  borderTopRightRadius?: number | string;
  borderStyle?: BorderStyle;
  overflow?: 'visible' | 'hidden';
  overlayColor?: ColorValue;
  tintColor?: ColorValue;
  opacity?: number | AnimatedNodeLike;
}

export type Falsy = undefined | null | false | '';
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- mirrors React Native's type
export interface RecursiveArray<T> extends ReadonlyArray<T | RecursiveArray<T>> {}
/** Legacy numeric style handle; accepted for type compatibility only. */
export type RegisteredStyle<T> = number & { __registeredStyleBrand: T };
export type StyleProp<T> =
  | T
  | RegisteredStyle<T>
  | RecursiveArray<T | RegisteredStyle<T> | Falsy>
  | Falsy;

/** Any style object accepted by `StyleSheet`. */
export type AnyStyle = ViewStyle | TextStyle | ImageStyle;
