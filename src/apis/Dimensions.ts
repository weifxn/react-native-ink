import { useMemo } from 'react';
import { useWindowSize } from 'ink';
import { currentStdout } from '../internal/root.js';
import type { EmitterSubscription } from './EventEmitter.js';

export interface ScaledSize {
  width: number;
  height: number;
  scale: number;
  fontScale: number;
}

export interface DimensionsChange {
  window: ScaledSize;
  screen: ScaledSize;
}

const fallback = (value: string | undefined, defaultValue: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
};

function sizeOf(stream: NodeJS.WriteStream): ScaledSize {
  return {
    width: stream.columns || fallback(process.env.COLUMNS, 80),
    height: stream.rows || fallback(process.env.LINES, 24),
    scale: 1,
    fontScale: 1,
  };
}

/** Terminal size in cells: `width` is columns, `height` is rows. */
export const Dimensions = {
  get(_dim: 'window' | 'screen'): ScaledSize {
    return sizeOf(currentStdout());
  },
  set(_dims: unknown): void {},
  addEventListener(_type: 'change', handler: (change: DimensionsChange) => void): EmitterSubscription {
    const stream = currentStdout();
    const listener = () => {
      const size = sizeOf(stream);
      handler({ window: size, screen: size });
    };
    stream.on('resize', listener);
    return {
      remove: () => {
        stream.off('resize', listener);
      },
    };
  },
};

/** Terminal size in cells; re-renders when the terminal is resized. */
export function useWindowDimensions(): ScaledSize {
  const { columns, rows } = useWindowSize();
  return useMemo(() => ({ width: columns, height: rows, scale: 1, fontScale: 1 }), [columns, rows]);
}

/** One layout unit is one cell, so the pixel ratio is always 1. */
export const PixelRatio = {
  get: (): number => 1,
  getFontScale: (): number => 1,
  getPixelSizeForLayoutSize: (layoutSize: number): number => Math.round(layoutSize),
  roundToNearestPixel: (layoutSize: number): number => Math.round(layoutSize),
  startDetecting(): void {},
};
