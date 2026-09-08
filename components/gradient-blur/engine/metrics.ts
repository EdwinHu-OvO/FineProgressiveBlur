import { toBandMetrics, type AtlasLayout } from "./atlas-layout";
import {
  GRADIENT_BLUR_SAMPLE_COUNT,
  type CaptureReason,
  type CaptureStrategy,
  type GradientBlurDirection,
  type GradientBlurMetrics,
} from "../types";

interface ReadyMetricOptions {
  adapterId: string;
  atlas: AtlasLayout;
  atlasBuildMs: number;
  captureCount: number;
  captureMs: number;
  direction: GradientBlurDirection;
  liveCapture: "continuous" | "snapshot";
  pixelRatio: number;
  renderCount?: number;
  renderFps?: number;
  reason: CaptureReason;
  sourceHeight: number;
  sourceWidth: number;
  strategy: CaptureStrategy;
  uploadMs: number;
}

export function createReadyMetrics({
  adapterId,
  atlas,
  atlasBuildMs,
  captureCount,
  captureMs,
  direction,
  liveCapture,
  pixelRatio,
  renderCount = 0,
  renderFps = 0,
  reason,
  sourceHeight,
  sourceWidth,
  strategy,
  uploadMs,
}: ReadyMetricOptions): GradientBlurMetrics {
  const atlasPixels = atlas.width * atlas.height;
  const sourcePixels = sourceWidth * sourceHeight;
  return {
    direction,
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
    sampleCount: GRADIENT_BLUR_SAMPLE_COUNT,
    renderCount,
    renderFps,
    liveCapture,
    adapterId,
    reason,
    bands: toBandMetrics(atlas.bands),
  };
}
