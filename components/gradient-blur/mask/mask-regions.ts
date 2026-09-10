import type { TextureCrop } from "../engine/atlas-texture";
import type { ResolvedBlurMask } from "./types";

export interface MaskGrid {
  columns: number;
  rows: number;
  cellSize: number;
  minimum: Float32Array;
  maximum: Float32Array;
}

/** Conservatively bounds every mask texel that bilinear sampling can touch. */
export function analyzeMask(
  mask: ResolvedBlurMask,
  width: number,
  height: number,
): MaskGrid {
  const cellSize = Math.max(32, Math.ceil(width / 32), Math.ceil(height / 32));
  const columns = Math.ceil(width / cellSize);
  const rows = Math.ceil(height / cellSize);
  const minimum = new Float32Array(columns * rows);
  const maximum = new Float32Array(columns * rows);
  for (let row = 0; row < rows; row++) {
    const top = Math.max(
      0,
      Math.floor(((row * cellSize) / height) * mask.height - 0.5),
    );
    const bottom = Math.min(
      mask.height - 1,
      Math.ceil(
        (Math.min(height, (row + 1) * cellSize) / height) * mask.height - 0.5,
      ),
    );
    for (let column = 0; column < columns; column++) {
      const left = Math.max(
        0,
        Math.floor(((column * cellSize) / width) * mask.width - 0.5),
      );
      const right = Math.min(
        mask.width - 1,
        Math.ceil(
          (Math.min(width, (column + 1) * cellSize) / width) * mask.width - 0.5,
        ),
      );
      let low = 255,
        high = 0;
      for (let y = top; y <= bottom; y++) {
        for (let x = left; x <= right; x++) {
          const strength = mask.values[y * mask.width + x];
          low = Math.min(low, strength);
          high = Math.max(high, strength);
        }
      }
      // Keep bounds conservative across Float32 rounding and GPU interpolation.
      minimum[row * columns + column] =
        low === 255 ? 1 : Math.max(0, low / 255 - 1e-6);
      maximum[row * columns + column] =
        high === 0 ? 0 : Math.min(1, high / 255 + 1e-6);
    }
  }
  return { columns, rows, cellSize, minimum, maximum };
}

/** Merge matching horizontal runs vertically. Never discard high-frequency regions. */
export function maskLevelRegions(
  grid: MaskGrid,
  levels: readonly number[],
  level: number,
  maxRadius: number,
): TextureCrop[] {
  const rectangles: TextureCrop[] = [];
  let active = new Map<string, TextureCrop>();
  const previous = levels[Math.max(0, level - 1)];
  const next = levels[level + 1] ?? Infinity;
  const needed = (index: number) =>
    grid.minimum[index] * maxRadius < next &&
    (level === 0 || grid.maximum[index] * maxRadius > previous);
  for (let y = 0; y < grid.rows; y++) {
    const row = new Map<string, TextureCrop>();
    let x = 0;
    while (x < grid.columns) {
      if (!needed(y * grid.columns + x)) {
        x++;
        continue;
      }
      const start = x++;
      while (x < grid.columns && needed(y * grid.columns + x)) x++;
      const key = `${start}:${x}`;
      const existing = active.get(key);
      const rect = existing ?? { x: start, y, width: x - start, height: 0 };
      rect.height++;
      if (!existing) rectangles.push(rect);
      row.set(key, rect);
    }
    active = row;
  }
  return rectangles.map((rect) => ({
    x: rect.x * grid.cellSize,
    y: rect.y * grid.cellSize,
    width: rect.width * grid.cellSize,
    height: rect.height * grid.cellSize,
  }));
}
