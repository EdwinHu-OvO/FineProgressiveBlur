import type { AtlasBand, AtlasLayout } from "./atlas-layout";
import {
  GRADIENT_BLUR_SAMPLE_COUNT,
  type CaptureReason,
  type CaptureStrategy,
  type GradientBlurDirection,
  type GradientBlurMode,
  type GradientBlurMetrics,
  type GradientBlurBandMetrics,
} from "../types";

interface ReadyMetricOptions {
  adapterId: string;
  atlas: AtlasLayout;
  atlasBuildMs: number;
  captureCount: number;
  captureMs: number;
  direction?: GradientBlurDirection;
  mode: GradientBlurMode;
  liveCapture: "continuous" | "snapshot";
  pixelRatio: number;
  renderCount?: number;
  renderFps?: number;
  reason: CaptureReason;
  sourceHeight: number;
  sourceWidth: number;
  strategy: CaptureStrategy;
  uploadMs: number;
  sampleCount?: number;
}

export function createReadyMetrics({
  adapterId,
  atlas,
  atlasBuildMs,
  captureCount,
  captureMs,
  direction,
  mode,
  liveCapture,
  pixelRatio,
  renderCount = 0,
  renderFps = 0,
  reason,
  sourceHeight,
  sourceWidth,
  strategy,
  uploadMs,
  sampleCount = GRADIENT_BLUR_SAMPLE_COUNT,
}: ReadyMetricOptions): GradientBlurMetrics {
  const atlasPixels = atlas.width * atlas.height;
  const sourcePixels = sourceWidth * sourceHeight;
  return {
    direction,
    mode,
    strategy,
    phase: "ready",
    captureCount,
    captureMs,
    atlasBuildMs,
    uploadMs,
    atlasWidth: atlas.width,
    atlasHeight: atlas.height,
    atlasBytes: atlasPixels * 4,
    sourceBytes: sourcePixels * 4,
    savedRatio: 1 - atlasPixels / sourcePixels,
    pixelRatio,
    sampleCount,
    renderCount,
    renderFps,
    liveCapture,
    adapterId,
    reason,
    bands: toBandMetrics(atlas.bands),
  };
}

function toBandMetrics(bands: readonly AtlasBand[]): GradientBlurBandMetrics[] {
  return bands.map(
    ({
      label,
      scale,
      width,
      height,
      coreStart,
      coreEnd,
      coreLeft,
      coreRight,
      sigma,
    }) => ({
      label,
      scale,
      atlasWidth: width,
      atlasHeight: height,
      coreStart,
      coreEnd,
      coreLeft,
      coreRight,
      sigma,
    }),
  );
}
