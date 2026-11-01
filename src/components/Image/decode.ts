import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type * as JpegJs from 'jpeg-js';
import type * as Pngjs from 'pngjs';

/** Decoded RGBA pixels. */
export interface Bitmap {
  width: number;
  height: number;
  data: Uint8Array;
}

export interface ImageURISource {
  uri?: string;
  width?: number;
  height?: number;
  headers?: Record<string, string>;
  method?: string;
  body?: string;
  cache?: 'default' | 'reload' | 'force-cache' | 'only-if-cached';
  scale?: number;
  bundle?: string;
}

/** React Native image sources; `require()`d asset numbers are not supported in Node. */
export type ImageSourcePropType = ImageURISource | ImageURISource[] | number | string;

const isPng = (bytes: Uint8Array) =>
  bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
const isJpeg = (bytes: Uint8Array) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;

async function importOptional<T>(name: string): Promise<T> {
  try {
    return (await import(name)) as T;
  } catch {
    throw new Error(
      `Install the optional "${name}" package to display this image (npm install ${name}).`,
    );
  }
}

async function readBytes(uri: string, headers?: Record<string, string>): Promise<Uint8Array> {
  if (uri.startsWith('data:')) {
    const comma = uri.indexOf(',');
    const meta = uri.slice(5, comma);
    const payload = uri.slice(comma + 1);
    return meta.endsWith(';base64')
      ? new Uint8Array(Buffer.from(payload, 'base64'))
      : new Uint8Array(Buffer.from(decodeURIComponent(payload)));
  }
  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    const response = await fetch(uri, { headers });
    if (!response.ok) throw new Error(`Failed to load ${uri}: HTTP ${response.status}`);
    return new Uint8Array(await response.arrayBuffer());
  }
  const path = uri.startsWith('file://') ? fileURLToPath(uri) : uri;
  return new Uint8Array(await readFile(path));
}

/** Decodes PNG (via `pngjs`) and JPEG (via `jpeg-js`) bytes into RGBA pixels. */
export async function decodeBytes(bytes: Uint8Array): Promise<Bitmap> {
  if (isPng(bytes)) {
    const { PNG } = await importOptional<typeof Pngjs>('pngjs');
    const png = PNG.sync.read(Buffer.from(bytes));
    return { width: png.width, height: png.height, data: new Uint8Array(png.data) };
  }
  if (isJpeg(bytes)) {
    const jpeg = await importOptional<typeof JpegJs>('jpeg-js');
    const decode = jpeg.decode ?? (jpeg as unknown as { default: typeof jpeg }).default.decode;
    const image = decode(bytes, { useTArray: true, formatAsRGBA: true });
    return { width: image.width, height: image.height, data: image.data };
  }
  throw new Error('Unsupported image format (PNG and JPEG are supported).');
}

const cache = new Map<string, Promise<Bitmap>>();

/** Loads and decodes an image, caching by URI. */
export function loadBitmap(uri: string, headers?: Record<string, string>): Promise<Bitmap> {
  let pending = cache.get(uri);
  if (!pending) {
    pending = readBytes(uri, headers).then(decodeBytes);
    pending.catch(() => cache.delete(uri));
    cache.set(uri, pending);
  }
  return pending;
}

export const isCached = (uri: string): boolean => cache.has(uri);

/** Normalizes any source prop into a single URI source (the first of an array). */
export function resolveSource(source: ImageSourcePropType | undefined): ImageURISource | undefined {
  if (source === undefined || source === null) return undefined;
  if (typeof source === 'string') return { uri: source };
  if (typeof source === 'number') return undefined;
  if (Array.isArray(source)) return source[0];
  return source;
}
