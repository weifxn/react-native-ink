import chalk from 'chalk';
import type { Bitmap } from './decode.js';

export type ResizeMode = 'cover' | 'contain' | 'stretch' | 'repeat' | 'center' | 'none';

type Pixel = [number, number, number, number];
const TRANSPARENT: Pixel = [0, 0, 0, 0];

/** Maps each target pixel to a source rectangle according to the resize mode. */
function mapping(bitmap: Bitmap, width: number, height: number, mode: ResizeMode) {
  const { width: w, height: h } = bitmap;
  if (mode === 'stretch') {
    return { scaleX: w / width, scaleY: h / height, offsetX: 0, offsetY: 0, repeat: false };
  }
  if (mode === 'repeat') {
    return { scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0, repeat: true };
  }
  const contain = Math.min(width / w, height / h);
  const scale =
    mode === 'cover'
      ? Math.max(width / w, height / h)
      : mode === 'center' || mode === 'none'
        ? Math.min(1, contain)
        : contain;
  const drawnWidth = w * scale;
  const drawnHeight = h * scale;
  return {
    scaleX: 1 / scale,
    scaleY: 1 / scale,
    offsetX: (width - drawnWidth) / 2,
    offsetY: (height - drawnHeight) / 2,
    repeat: false,
  };
}

/** Averages the source pixels covering one target pixel (box filter). */
function sample(bitmap: Bitmap, x0: number, y0: number, x1: number, y1: number): Pixel {
  const { width, height, data } = bitmap;
  const left = Math.max(0, Math.floor(x0));
  const top = Math.max(0, Math.floor(y0));
  const right = Math.min(width, Math.max(left + 1, Math.ceil(x1)));
  const bottom = Math.min(height, Math.max(top + 1, Math.ceil(y1)));
  if (left >= width || top >= height || right <= 0 || bottom <= 0) return TRANSPARENT;
  let r = 0;
  let g = 0;
  let b = 0;
  let a = 0;
  let count = 0;
  for (let y = top; y < bottom; y++) {
    for (let x = left; x < right; x++) {
      const i = (y * width + x) * 4;
      const alpha = data[i + 3]!;
      r += data[i]! * alpha;
      g += data[i + 1]! * alpha;
      b += data[i + 2]! * alpha;
      a += alpha;
      count++;
    }
  }
  if (a === 0) return TRANSPARENT;
  return [Math.round(r / a), Math.round(g / a), Math.round(b / a), Math.round(a / count)];
}

/**
 * Renders a bitmap into `columns` × `rows` terminal cells using half blocks: each cell shows two
 * vertical pixels (`▀` with foreground = top pixel, background = bottom pixel).
 */
export function rasterize(bitmap: Bitmap, columns: number, rows: number, mode: ResizeMode = 'cover'): string[] {
  const width = Math.max(1, Math.round(columns));
  const height = Math.max(1, Math.round(rows)) * 2;
  const map = mapping(bitmap, width, height, mode);
  const pixelAt = (x: number, y: number): Pixel => {
    let sx = (x - map.offsetX) * map.scaleX;
    let sy = (y - map.offsetY) * map.scaleY;
    if (map.repeat) {
      sx = ((sx % bitmap.width) + bitmap.width) % bitmap.width;
      sy = ((sy % bitmap.height) + bitmap.height) % bitmap.height;
    } else if (sx < 0 || sy < 0 || sx >= bitmap.width || sy >= bitmap.height) {
      return TRANSPARENT;
    }
    return sample(bitmap, sx, sy, sx + map.scaleX, sy + map.scaleY);
  };

  const lines: string[] = [];
  for (let row = 0; row < height / 2; row++) {
    let line = '';
    for (let x = 0; x < width; x++) {
      const top = pixelAt(x, row * 2);
      const bottom = pixelAt(x, row * 2 + 1);
      const topVisible = top[3] >= 128;
      const bottomVisible = bottom[3] >= 128;
      if (topVisible && bottomVisible) {
        line += chalk.rgb(top[0], top[1], top[2]).bgRgb(bottom[0], bottom[1], bottom[2])('▀');
      } else if (topVisible) {
        line += chalk.rgb(top[0], top[1], top[2])('▀');
      } else if (bottomVisible) {
        line += chalk.rgb(bottom[0], bottom[1], bottom[2])('▄');
      } else {
        line += ' ';
      }
    }
    lines.push(line);
  }
  return lines;
}
