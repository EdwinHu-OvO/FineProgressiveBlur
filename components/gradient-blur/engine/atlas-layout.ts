import type { GradientBlurBezier } from "../types";
import { blurRadiusAt } from "./profile";

const GUTTER = 1;

export interface AtlasBand {
  label: "outer" | "middle" | "inner";
  scale: number;
  coreStart: number;
  coreEnd: number;
  coreLeft?: number;
  coreRight?: number;
  blendEnd: number;
  captureStart: number;
  captureEnd: number;
  /** Optional horizontal crop and constant sigma for 2D mask patches. */
  captureLeft?: number;
  captureRight?: number;
  sigma?: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AtlasLayout {
  sourceWidth: number;
  sourceHeight: number;
  width: number;
  height: number;
  bands: readonly AtlasBand[];
}

export const MAX_ATLAS_BANDS = 8;
export const MAX_TEXEL_SIGMA = 4;
const LEVELS = Array.from({ length: MAX_ATLAS_BANDS }, (_, index) => {
  const scale = 2 ** (index + 1 - MAX_ATLAS_BANDS);
  return {
    label: (scale === 1
      ? "inner"
      : scale === 0.5
        ? "middle"
        : "outer") as AtlasBand["label"],
    scale,
    minimumRadius: scale === 1 ? 0 : 2 / scale,
  };
});

// Radius is measured in source pixels. A reduced texel must fit comfortably
// inside the local kernel; near zero blur the source stays at native DPR.
function levelEnd(
  maxRadius: number,
  minimumRadius: number,
  curve?: GradientBlurBezier,
): number {
  if (minimumRadius === 0) return 1;
  if (maxRadius <= minimumRadius) return 0;
  let low = 0;
  let high = 1;
  for (let iteration = 0; iteration < 24; iteration += 1) {
    const middle = (low + high) / 2;
    if (blurRadiusAt(middle, maxRadius, curve) >= minimumRadius) low = middle;
    else high = middle;
  }
  return low;
}

export function createAtlasLayout(
  sourceWidth: number,
  sourceHeight: number,
  maxRadius: number,
  pixelRatio: number,
  curve?: GradientBlurBezier,
): AtlasLayout {
  const radius = Number.isFinite(maxRadius) ? Math.max(0, maxRadius) : 0;
  const bands: AtlasBand[] = [];
  let start = 0;
  for (const level of LEVELS) {
    const end = levelEnd(radius * pixelRatio, level.minimumRadius, curve);
    if (end <= start || (end < 1 && (end - start) * sourceHeight < 1)) continue;
    // Crossfade while this level's sigma falls from 2 to 1.5 texels. The next
    // level then stays within 3–4 texels, including the entire transition.
    const blendEnd = levelEnd(
      radius * pixelRatio,
      level.minimumRadius * 0.75,
      curve,
    );
    // Align crops to the shared pyramid's actual texel grid, including odd
    // dimensions. Packing must never stretch a rounded crop into another size.
    const halo = Math.ceil(3 * blurRadiusAt(start, radius, curve) * pixelRatio);
    const guard = Math.ceil(1 / level.scale);
    const captureStartPixel = Math.max(
      0,
      Math.floor(start * sourceHeight) - guard - halo,
    );
    const captureEndPixel = Math.min(
      sourceHeight,
      Math.ceil(blendEnd * sourceHeight) + guard + halo,
    );
    const levelHeight = Math.max(1, Math.ceil(sourceHeight * level.scale));
    const captureStartRow = Math.floor(
      (captureStartPixel / sourceHeight) * levelHeight,
    );
    const captureEndRow = Math.ceil(
      (captureEndPixel / sourceHeight) * levelHeight,
    );
    const captureStart = captureStartRow / levelHeight;
    const captureEnd = captureEndRow / levelHeight;
    bands.push({
      label: level.label,
      scale: level.scale,
      coreStart: start,
      coreEnd: end,
      blendEnd,
      captureStart,
      captureEnd,
      x: 0,
      y: 0,
      width: Math.max(1, Math.ceil(sourceWidth * level.scale)),
      height: Math.max(1, captureEndRow - captureStartRow),
    });
    start = end;
  }

  const inner = bands[bands.length - 1];
  inner.x = GUTTER;
  inner.y = GUTTER;
  const secondRowY = inner.y + inner.height + GUTTER * 2;
  let rowWidth = 0;
  let rowHeight = 0;
  for (const band of bands.slice(0, -1)) {
    band.x = rowWidth + GUTTER;
    band.y = secondRowY;
    rowWidth += band.width + GUTTER * 2;
    rowHeight = Math.max(rowHeight, band.height);
  }

  return {
    sourceWidth,
    sourceHeight,
    width: Math.max(inner.width + GUTTER * 2, rowWidth),
    height: rowHeight
      ? secondRowY + rowHeight + GUTTER
      : inner.height + GUTTER * 2,
    bands,
  };
}

export function createUniformAtlasLayout(
  sourceWidth: number,
  sourceHeight: number,
  sigma: number,
  pixelRatio: number,
): AtlasLayout {
  const radius = Number.isFinite(sigma) ? Math.max(0, sigma) : 0;
  const exponent = Math.min(
    0,
    Math.floor(
      Math.log2(MAX_TEXEL_SIGMA / Math.max(radius * pixelRatio, 0.001)),
    ),
  );
  const scale = Math.max(2 ** (1 - MAX_ATLAS_BANDS), 2 ** exponent);
  const width = Math.max(1, Math.ceil(sourceWidth * scale));
  const height = Math.max(1, Math.ceil(sourceHeight * scale));
  return {
    sourceWidth,
    sourceHeight,
    width: width + GUTTER * 2,
    height: height + GUTTER * 2,
    bands: [
      {
        label: "inner",
        scale,
        coreStart: 0,
        coreEnd: 1,
        blendEnd: 1,
        captureStart: 0,
        captureEnd: 1,
        x: GUTTER,
        y: GUTTER,
        width,
        height,
      },
    ],
  };
}

export const ATLAS_GUTTER = GUTTER;
