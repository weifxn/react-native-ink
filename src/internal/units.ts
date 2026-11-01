import { createContext } from 'react';

/**
 * How many layout units one terminal cell is.
 *
 * The default, 1×1, makes every style number a cell count (`width: 20` is 20 columns). Code
 * shared with a React Native app is written in density-independent pixels instead, so such an
 * app sets a cell size first — `{ width: 8, height: 16 }` reads `padding: 16` as 2 columns and
 * 1 row — and gets layout events, `Dimensions` and scroll positions back in those units too.
 */
export interface CellSize {
  readonly width: number;
  readonly height: number;
}

export const UNIT_CELL: CellSize = Object.freeze({ width: 1, height: 1 });

let current: CellSize = UNIT_CELL;

const isPositive = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

/**
 * Sets how many layout units one terminal cell is, for every app in the process. Call it before
 * rendering (and before importing code that reads `Dimensions` at load time): components that
 * already rendered are not updated. A number sets both sides; `null` restores 1×1.
 */
export function setCellSize(size: CellSize | number | null | undefined): void {
  if (size === null || size === undefined) {
    current = UNIT_CELL;
    return;
  }
  const width = typeof size === 'number' ? size : size.width;
  const height = typeof size === 'number' ? size : size.height;
  if (!isPositive(width) || !isPositive(height)) {
    throw new TypeError(`setCellSize expects positive numbers, received ${JSON.stringify(size)}.`);
  }
  current = width === 1 && height === 1 ? UNIT_CELL : Object.freeze({ width, height });
}

/** The cell size set with `setCellSize` (1×1 by default). */
export function getCellSize(): CellSize {
  return current;
}

export const isUnitCell = (cell: CellSize): boolean => cell.width === 1 && cell.height === 1;

/** `x` is along a row (columns), `y` down a column (rows). */
export type Axis = 'x' | 'y';

/**
 * - `size`: widths, heights and flex bases. A positive size never rounds down to nothing, so a
 *   6-unit dot is still one cell.
 * - `space`: margins, paddings, gaps and offsets, which may round to 0.
 */
export type LengthKind = 'size' | 'space';

const factorOf = (cell: CellSize, axis: Axis) => (axis === 'x' ? cell.width : cell.height);

/** Converts a length in layout units to whole cells (unchanged at 1×1). */
export function toCells(value: number, cell: CellSize, axis: Axis, kind: LengthKind): number {
  const factor = factorOf(cell, axis);
  if (factor === 1) return value;
  const cells = Math.round(Math.abs(value) / factor);
  if (cells === 0) return kind === 'size' && value > 0 ? 1 : 0;
  return value < 0 ? -cells : cells;
}

/** Converts a cell count back to layout units. */
export function fromCells(cells: number, cell: CellSize, axis: Axis): number {
  return cells * factorOf(cell, axis);
}

/** Converts a measured frame (cells) to layout units. */
export function frameFromCells<T extends { x: number; y: number; width: number; height: number }>(
  frame: T,
  cell: CellSize,
): T {
  if (isUnitCell(cell)) return frame;
  return {
    ...frame,
    x: frame.x * cell.width,
    y: frame.y * cell.height,
    width: frame.width * cell.width,
    height: frame.height * cell.height,
  };
}

/**
 * The flex direction of the nearest View, so a child's `flexBasis` (a length along its parent's
 * main axis) is scaled as a width or a height. Only provided when the cell size isn't 1×1.
 */
export const FlexDirectionContext = createContext<string>('column');
FlexDirectionContext.displayName = 'FlexDirectionContext';

export const isRowDirection = (direction: unknown): boolean =>
  direction === 'row' || direction === 'row-reverse';
