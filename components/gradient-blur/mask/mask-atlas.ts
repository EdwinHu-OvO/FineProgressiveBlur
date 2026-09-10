import {
  type AtlasBand,
  type AtlasLayout,
  MAX_TEXEL_SIGMA,
} from "../engine/atlas-layout";
import type { TextureCrop } from "../engine/atlas-texture";
import { packMaskPatches } from "./atlas-packing";
import { maskBlurLevels } from "./mask-levels";
import { maskLevelRegions, type MaskGrid } from "./mask-regions";
import type { OverlayCaptureRegion } from "../engine/overlay-capture";

export interface MaskPatch extends AtlasBand {
  core: TextureCrop;
  level: number;
  sigma: number;
  captureLeft: number;
  captureRight: number;
}

export interface MaskAtlasLayout extends AtlasLayout {
  bands: readonly MaskPatch[];
  levels: readonly number[];
  maskRegion: TextureCrop;
}

export function createMaskAtlasLayout(
  grid: MaskGrid,
  width: number,
  height: number,
  maxRadius: number,
  pixelRatio: number,
  maxTextureSize = 8192,
  capture?: OverlayCaptureRegion,
): MaskAtlasLayout {
  const sourceWidth = capture?.width ?? width;
  const sourceHeight = capture?.height ?? height;
  const offsetX = capture?.offsetX ?? 0,
    offsetY = capture?.offsetY ?? 0;
  const maskRegion = { x: offsetX, y: offsetY, width, height };
  const levels = maskBlurLevels(maxRadius, pixelRatio);
  const radius = levels.at(-1)!;
  const bands: MaskPatch[] = [];
  levels.forEach((sigma, level) => {
    const scale = Math.max(
      1 / 128,
      2 **
        Math.min(
          0,
          Math.floor(
            Math.log2(MAX_TEXEL_SIGMA / Math.max(sigma * pixelRatio, 0.001)),
          ),
        ),
    );
    const levelWidth = Math.max(1, Math.ceil(sourceWidth * scale));
    const levelHeight = Math.max(1, Math.ceil(sourceHeight * scale));
    const halo = Math.ceil(3 * sigma * pixelRatio) + Math.ceil(1 / scale);
    const makePatch = (region: TextureCrop): MaskPatch => {
      const core = {
        ...region,
        width: Math.min(width - region.x, region.width),
        height: Math.min(height - region.y, region.height),
      };
      const left = Math.floor(
        (Math.max(0, core.x + offsetX - halo) / sourceWidth) * levelWidth,
      );
      const top = Math.floor(
        (Math.max(0, core.y + offsetY - halo) / sourceHeight) * levelHeight,
      );
      const right = Math.ceil(
        (Math.min(sourceWidth, core.x + offsetX + core.width + halo) /
          sourceWidth) *
          levelWidth,
      );
      const bottom = Math.ceil(
        (Math.min(sourceHeight, core.y + offsetY + core.height + halo) /
          sourceHeight) *
          levelHeight,
      );
      return {
        label: scale === 1 ? "inner" : scale === 0.5 ? "middle" : "outer",
        scale,
        sigma,
        level,
        core,
        coreStart: core.y / height,
        coreEnd: (core.y + core.height) / height,
        coreLeft: core.x / width,
        coreRight: (core.x + core.width) / width,
        blendEnd: (core.y + core.height) / height,
        captureLeft: left / levelWidth,
        captureRight: right / levelWidth,
        captureStart: top / levelHeight,
        captureEnd: bottom / levelHeight,
        x: 0,
        y: 0,
        width: right - left,
        height: bottom - top,
      };
    };
    const regions = maskLevelRegions(grid, levels, level, radius);
    if (!regions.length) return;
    const patches = regions.map(makePatch);
    const left = Math.min(...regions.map((region) => region.x));
    const top = Math.min(...regions.map((region) => region.y));
    const merged = makePatch({
      x: left,
      y: top,
      width:
        Math.max(...regions.map((region) => region.x + region.width)) - left,
      height:
        Math.max(...regions.map((region) => region.y + region.height)) - top,
    });
    // Broad kernels overlap heavily. Coalesce when halos cost more than their
    // bounding rectangle, or bound draw calls for adversarial masks.
    const separateArea = patches.reduce(
      (area, patch) => area + patch.width * patch.height,
      0,
    );
    if (patches.length > 24 || merged.width * merged.height <= separateArea)
      bands.push(merged);
    else bands.push(...patches);
  });
  return {
    sourceWidth,
    sourceHeight,
    maskRegion,
    levels,
    bands,
    ...packMaskPatches(bands, maxTextureSize),
  };
}
