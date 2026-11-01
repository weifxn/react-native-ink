import chalk from 'chalk';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from 'ink-testing-library';
import { Image, ImageBackground, Text } from '../src/index.js';
import { rasterize } from '../src/components/Image/rasterize.js';
import { decodeBytes } from '../src/components/Image/decode.js';
import { renderInteractive, tick } from './helpers.js';

type RGBA = [number, number, number, number];

/** Builds a PNG data URI from rows of RGBA pixels. */
function pngDataUri(pixels: RGBA[][]): string {
  const height = pixels.length;
  const width = pixels[0]!.length;
  const png = new PNG({ width, height });
  pixels.forEach((row, y) =>
    row.forEach((pixel, x) => {
      png.data.set(pixel, (y * width + x) * 4);
    }),
  );
  return `data:image/png;base64,${PNG.sync.write(png).toString('base64')}`;
}

const RED: RGBA = [255, 0, 0, 255];
const BLUE: RGBA = [0, 0, 255, 255];
const CLEAR: RGBA = [0, 0, 0, 0];

// 2×4: two red rows over two blue rows.
const RED_OVER_BLUE = pngDataUri([
  [RED, RED],
  [RED, RED],
  [BLUE, BLUE],
  [BLUE, BLUE],
]);

let previousLevel = chalk.level;
beforeEach(() => {
  previousLevel = chalk.level;
  chalk.level = 3;
});
afterEach(() => {
  chalk.level = previousLevel;
  cleanup();
});

// Ink merges adjacent cells that share a style into one escape sequence.
const RED_ROW = '\u001b[38;2;255;0;0m\u001b[48;2;255;0;0m▀▀\u001b[49m\u001b[39m';
const BLUE_ROW = '\u001b[38;2;0;0;255m\u001b[48;2;0;0;255m▀▀\u001b[49m\u001b[39m';

describe('rasterize', () => {
  it('draws two pixel rows per cell with half blocks', () => {
    const bitmap = { width: 1, height: 2, data: new Uint8Array([...RED, ...BLUE]) };
    expect(rasterize(bitmap, 1, 1, 'stretch')).toEqual([
      '\u001b[38;2;255;0;0m\u001b[48;2;0;0;255m▀\u001b[49m\u001b[39m',
    ]);
  });

  it('leaves transparent pixels empty and uses lower half blocks', () => {
    const bitmap = { width: 1, height: 2, data: new Uint8Array([...CLEAR, ...BLUE]) };
    expect(rasterize(bitmap, 1, 1, 'stretch')).toEqual(['\u001b[38;2;0;0;255m▄\u001b[39m']);
  });

  it('letterboxes with contain', () => {
    const wide = { width: 4, height: 2, data: new Uint8Array(new Array(8).fill(RED).flat()) };
    const lines = rasterize(wide, 4, 3, 'contain');
    expect(lines[0]).toBe('    ');
    expect(lines[1]).toContain('▀');
    expect(lines[2]).toBe('    ');
  });
});

describe('decoding', () => {
  it('decodes PNG and JPEG', async () => {
    const pngBytes = Buffer.from(RED_OVER_BLUE.split(',')[1]!, 'base64');
    expect(await decodeBytes(new Uint8Array(pngBytes))).toMatchObject({ width: 2, height: 4 });
    const raw = { width: 3, height: 2, data: Buffer.alloc(3 * 2 * 4, 200) };
    const jpg = jpeg.encode(raw, 90).data;
    expect(await decodeBytes(new Uint8Array(jpg))).toMatchObject({ width: 3, height: 2 });
    await expect(decodeBytes(new Uint8Array([1, 2, 3, 4]))).rejects.toThrow(
      /Unsupported image format/,
    );
  });
});

describe('Image', () => {
  it('loads a data URI and draws it at the given size', async () => {
    const onLoad = vi.fn();
    const { lastFrame } = renderInteractive(
      <Image source={{ uri: RED_OVER_BLUE }} style={{ width: 2, height: 2 }} onLoad={onLoad} />,
    );
    await tick(100);
    expect(lastFrame()).toBe(`${RED_ROW}\n${BLUE_ROW}`);
    expect(onLoad.mock.calls[0]?.[0].nativeEvent.source).toEqual({
      width: 2,
      height: 4,
      uri: RED_OVER_BLUE,
    });
  });

  it('derives the height from the aspect ratio', async () => {
    const { lastFrame } = renderInteractive(
      <Image source={RED_OVER_BLUE as never} style={{ width: 2 }} />,
    );
    await tick(100);
    expect(lastFrame()?.split('\n')).toHaveLength(2);
  });

  it('shows alt text and calls onError when loading fails', async () => {
    const onError = vi.fn();
    const { lastFrame } = renderInteractive(
      <Image
        source={{ uri: '/does/not/exist.png' }}
        alt="logo"
        style={{ width: 8, height: 1 }}
        onError={onError}
      />,
    );
    await tick(100);
    expect(lastFrame()).toContain('logo');
    expect(onError).toHaveBeenCalledOnce();
  });

  it('reports image sizes', async () => {
    await expect(Image.getSize(RED_OVER_BLUE)).resolves.toEqual({ width: 2, height: 4 });
    const success = vi.fn();
    await Image.getSize(RED_OVER_BLUE, success);
    expect(success).toHaveBeenCalledWith(2, 4);
    await expect(Image.prefetch(RED_OVER_BLUE)).resolves.toBe(true);
    await expect(Image.queryCache([RED_OVER_BLUE, 'other'])).resolves.toEqual({
      [RED_OVER_BLUE]: 'memory',
    });
  });

  it('draws children over an ImageBackground', async () => {
    const { lastFrame } = renderInteractive(
      <ImageBackground source={{ uri: RED_OVER_BLUE }} style={{ width: 4, height: 2 }}>
        <Text>hi</Text>
      </ImageBackground>,
    );
    await tick(150);
    const frame = lastFrame() ?? '';
    expect(frame).toContain('hi');
    expect(frame).toContain('▀');
  });
});
