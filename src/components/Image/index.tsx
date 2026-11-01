import chalk from 'chalk';
import {
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from 'react';
import { Box, Text as InkText, useBoxMetrics, type DOMElement } from 'ink';
import { StyleSheet } from '../../apis/StyleSheet.js';
import { resolveAccessibility, type AccessibilityProps } from '../../internal/accessibility.js';
import {
  createSyntheticEvent,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
} from '../../internal/events.js';
import { LayoutObserver } from '../../internal/LayoutObserver.js';
import { attachNativeMethods, type HostInstance } from '../../internal/nativeMethods.js';
import { currentStdout } from '../../internal/root.js';
import { isUnicodeSupported } from '../../internal/terminal.js';
import { flattenStyle } from '../../style/flatten.js';
import type { ColorValue, ImageStyle, StyleProp } from '../../style/types.js';
import { VIEW_DEFAULTS, resolveViewStyle } from '../../style/view.js';
import { withBorderBackground } from '../../style/colors.js';
import { BackgroundColorContext } from '../../internal/contexts.js';
import { FlexDirectionContext, getCellSize, toCells } from '../../internal/units.js';
import { View } from '../View/index.js';
import {
  isCached,
  loadBitmap,
  resolveSource,
  type Bitmap,
  type ImageSourcePropType,
  type ImageURISource,
} from './decode.js';
import { rasterize, type ResizeMode } from './rasterize.js';

export type { ImageSourcePropType, ImageURISource };

export type ImageLoadEvent = NativeSyntheticEvent<{
  source: { width: number; height: number; uri: string };
}>;
export type ImageErrorEvent = NativeSyntheticEvent<{ error: string }>;

export interface ImageProps extends AccessibilityProps {
  /** A local path, `file://` URL, `http(s)://` URL or `data:` URI. PNG and JPEG are supported. */
  source?: ImageSourcePropType;
  src?: string;
  /** @remarks Not shown in terminals; the alt text appears while loading instead. */
  defaultSource?: ImageSourcePropType;
  /** Size in cells. With one dimension, the other follows the image's aspect ratio. */
  style?: StyleProp<ImageStyle>;
  resizeMode?: ResizeMode;
  width?: number;
  height?: number;
  /** Shown while loading, on errors, and when the terminal can't draw colors. */
  alt?: string;
  onLoadStart?: () => void;
  onLoad?: (event: ImageLoadEvent) => void;
  onLoadEnd?: () => void;
  onError?: (event: ImageErrorEvent) => void;
  onLayout?: (event: LayoutChangeEvent) => void;
  testID?: string;
  nativeID?: string;
  /** @remarks Ignored in terminals. */
  blurRadius?: number;
  /** @remarks Ignored in terminals. */
  tintColor?: ColorValue;
  /** @remarks Ignored in terminals. */
  fadeDuration?: number;
  /** @remarks Ignored in terminals. */
  onProgress?: (event: unknown) => void;
  /** @remarks Ignored in terminals. */
  progressiveRenderingEnabled?: boolean;
  /** @remarks Ignored in terminals. */
  resizeMethod?: 'auto' | 'resize' | 'scale' | 'none';
  /** @remarks Ignored in terminals. */
  capInsets?: { top?: number; left?: number; bottom?: number; right?: number };
  /** @remarks Ignored in terminals. */
  crossOrigin?: 'anonymous' | 'use-credentials';
  /** @remarks Ignored in terminals. */
  referrerPolicy?: string;
  ref?: Ref<HostInstance | null>;
}

const positive = (value: unknown) => (typeof value === 'number' && value > 0 ? value : undefined);

const OBJECT_FIT: Record<string, ResizeMode> = {
  cover: 'cover',
  contain: 'contain',
  fill: 'stretch',
  'scale-down': 'center',
  none: 'none',
};

/**
 * Draws PNG/JPEG images with colored half-block characters (two pixel rows per cell).
 * Decoding uses the optional `pngjs` / `jpeg-js` packages.
 */
export function Image(props: ImageProps) {
  const {
    source,
    src,
    style,
    resizeMode: resizeModeProp,
    width: widthProp,
    height: heightProp,
    alt,
    onLoadStart,
    onLoad,
    onLoadEnd,
    onError,
    onLayout,
    ref,
  } = props;
  const uriSource = resolveSource(src ? { uri: src } : source);
  const uri = uriSource?.uri;
  const flat = (flattenStyle(style) ?? {}) as ImageStyle;
  const parentDirection = useContext(FlexDirectionContext);
  const inheritedBackground = useContext(BackgroundColorContext);
  const resizeMode =
    resizeModeProp ??
    flat.resizeMode ??
    (flat.objectFit ? OBJECT_FIT[flat.objectFit] : undefined) ??
    'cover';

  const [state, setState] = useState<{ uri?: string; bitmap?: Bitmap; error?: string }>({});
  const callbacks = useRef({ onLoadStart, onLoad, onLoadEnd, onError });
  callbacks.current = { onLoadStart, onLoad, onLoadEnd, onError };
  const headers = uriSource?.headers;
  useEffect(() => {
    if (!uri) return;
    let cancelled = false;
    callbacks.current.onLoadStart?.();
    loadBitmap(uri, headers).then(
      (bitmap) => {
        if (cancelled) return;
        setState({ uri, bitmap });
        callbacks.current.onLoad?.(
          createSyntheticEvent('load', {
            source: { width: bitmap.width, height: bitmap.height, uri },
          }),
        );
        callbacks.current.onLoadEnd?.();
      },
      (error: unknown) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        setState({ uri, error: message });
        callbacks.current.onError?.(createSyntheticEvent('error', { error: message }));
        callbacks.current.onLoadEnd?.();
      },
    );
    return () => {
      cancelled = true;
    };
    // Headers are part of the request only; reload when the URI changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uri]);
  const bitmap = state.uri === uri ? state.bitmap : undefined;

  const boxRef = useRef<DOMElement>(null);
  useImperativeHandle(
    ref,
    () =>
      boxRef.current ? attachNativeMethods(boxRef.current) : (null as unknown as HostInstance),
    [],
  );
  const metrics = useBoxMetrics(boxRef);

  // Sizes from layout (percentages, flex, absolute fill) are read back after layout.
  const layoutSized =
    typeof flat.width === 'string' ||
    typeof flat.height === 'string' ||
    flat.flex !== undefined ||
    (typeof flat.flexGrow === 'number' && flat.flexGrow > 0) ||
    (flat.position === 'absolute' &&
      ((flat.left !== undefined && flat.right !== undefined) ||
        (flat.top !== undefined && flat.bottom !== undefined)));

  // Explicit sizes are layout units; the bitmap's natural size (below) is already in cells.
  const cellSize = getCellSize();
  const asColumns = (value: number | undefined) =>
    value === undefined ? undefined : toCells(value, cellSize, 'x', 'size');
  const asRows = (value: number | undefined) =>
    value === undefined ? undefined : toCells(value, cellSize, 'y', 'size');
  let columns = asColumns(
    positive(flat.width) ?? positive(widthProp) ?? positive(uriSource?.width),
  );
  let rows = asRows(positive(flat.height) ?? positive(heightProp) ?? positive(uriSource?.height));
  if (layoutSized) {
    columns = metrics.hasMeasured && metrics.clientWidth > 0 ? metrics.clientWidth : undefined;
    rows = metrics.hasMeasured && metrics.clientHeight > 0 ? metrics.clientHeight : undefined;
  } else if (bitmap) {
    const ratio = bitmap.height / bitmap.width;
    if (columns === undefined && rows === undefined) {
      columns = Math.min(bitmap.width, currentStdout().columns || 80);
    }
    if (columns !== undefined && rows === undefined)
      rows = Math.max(1, Math.ceil((columns * ratio) / 2));
    if (rows !== undefined && columns === undefined)
      columns = Math.max(1, Math.round((rows * 2) / ratio));
  }

  const canDraw = chalk.level > 0 && isUnicodeSupported();
  const lines = useMemo(
    () =>
      bitmap && canDraw && columns && rows
        ? rasterize(bitmap, columns, rows, resizeMode)
        : undefined,
    [bitmap, canDraw, columns, rows, resizeMode],
  );

  const view = resolveViewStyle(flat, {
    component: 'Image',
    defaults: VIEW_DEFAULTS,
    cellSize,
    parentDirection,
    background: inheritedBackground,
  });
  const box = withBorderBackground(
    { ...view.box, ...resolveAccessibility({ accessibilityLabel: alt, ...props }) },
    inheritedBackground,
  );
  if (!layoutSized) {
    if (columns !== undefined) box.width = columns;
    if (rows !== undefined) box.height = rows;
  }
  box.overflow = 'hidden';

  let content: ReactNode = null;
  if (lines) content = <InkText wrap="truncate-end">{lines.join('\n')}</InkText>;
  else if (alt) content = <InkText dimColor>{alt}</InkText>;

  return (
    <Box ref={boxRef} {...box}>
      {content}
      {onLayout ? <LayoutObserver target={boxRef} onLayout={onLayout} /> : null}
    </Box>
  );
}

function withCallbacks<T>(
  promise: Promise<T>,
  success?: (value: T) => void,
  failure?: (error: unknown) => void,
) {
  if (success || failure) promise.then(success, failure ?? (() => {}));
  return promise;
}

Image.getSize = (
  uri: string,
  success?: (width: number, height: number) => void,
  failure?: (error: unknown) => void,
): Promise<{ width: number; height: number }> =>
  withCallbacks(
    loadBitmap(uri).then(({ width, height }) => ({ width, height })),
    success ? ({ width, height }) => success(width, height) : undefined,
    failure,
  );

Image.getSizeWithHeaders = (
  uri: string,
  headers: Record<string, string>,
  success?: (width: number, height: number) => void,
  failure?: (error: unknown) => void,
): Promise<{ width: number; height: number }> =>
  withCallbacks(
    loadBitmap(uri, headers).then(({ width, height }) => ({ width, height })),
    success ? ({ width, height }) => success(width, height) : undefined,
    failure,
  );

Image.prefetch = (url: string): Promise<boolean> => loadBitmap(url).then(() => true);
Image.prefetchWithMetadata = (url: string): Promise<boolean> => Image.prefetch(url);
Image.abortPrefetch = (_requestId: number): void => {};
Image.queryCache = async (urls: string[]): Promise<Record<string, 'memory'>> =>
  Object.fromEntries(urls.filter(isCached).map((url) => [url, 'memory' as const]));
Image.resolveAssetSource = (source: ImageSourcePropType) => {
  const resolved = resolveSource(source);
  return resolved
    ? {
        uri: resolved.uri ?? '',
        width: resolved.width ?? 0,
        height: resolved.height ?? 0,
        scale: resolved.scale ?? 1,
      }
    : null;
};

export interface ImageBackgroundProps extends ImageProps {
  children?: ReactNode;
  imageStyle?: StyleProp<ImageStyle>;
  imageRef?: Ref<HostInstance | null>;
}

/** An Image filling a View, with children drawn on top. */
export function ImageBackground({
  children,
  style,
  imageStyle,
  imageRef,
  ...props
}: ImageBackgroundProps) {
  return (
    <View style={style as StyleProp<never>}>
      <Image
        {...props}
        ref={imageRef}
        style={[StyleSheet.absoluteFill as ImageStyle, imageStyle]}
      />
      {children}
    </View>
  );
}
