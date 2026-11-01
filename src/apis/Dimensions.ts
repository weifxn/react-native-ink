import { useMemo } from 'react';
import { currentStdout } from '../internal/root.js';
import { getCellSize } from '../internal/units.js';
import { sizeOfStream, useTerminalSize } from '../internal/useTerminalSize.js';
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

/** A terminal of `columns` × `rows` cells, in layout units (see `setCellSize`). */
function scaled(columns: number, rows: number): ScaledSize {
  const cell = getCellSize();
  return { width: columns * cell.width, height: rows * cell.height, scale: 1, fontScale: 1 };
}

function sizeOf(stream: NodeJS.WriteStream): ScaledSize {
  const { columns, rows } = sizeOfStream(stream);
  return scaled(columns, rows);
}

/**
 * Terminal size: `width` is columns and `height` is rows, times the cell size when one is set
 * with `setCellSize`.
 */
export const Dimensions = {
  get(_dim: 'window' | 'screen'): ScaledSize {
    return sizeOf(currentStdout());
  },
  set(_dims: unknown): void {},
  addEventListener(
    _type: 'change',
    handler: (change: DimensionsChange) => void,
  ): EmitterSubscription {
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

/** Terminal size (in layout units, like `Dimensions`); re-renders when the terminal is resized. */
export function useWindowDimensions(): ScaledSize {
  const { columns, rows } = useTerminalSize();
  return useMemo(() => scaled(columns, rows), [columns, rows]);
}

/** One layout unit is one cell, so the pixel ratio is always 1. */
export const PixelRatio = {
  get: (): number => 1,
  getFontScale: (): number => 1,
  getPixelSizeForLayoutSize: (layoutSize: number): number => Math.round(layoutSize),
  roundToNearestPixel: (layoutSize: number): number => Math.round(layoutSize),
  startDetecting(): void {},
};
