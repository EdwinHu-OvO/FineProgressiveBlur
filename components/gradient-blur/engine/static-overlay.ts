import type { CaptureReason } from "../types";
import { createReadyMetrics } from "./metrics";
import { overlayViewport } from "./overlay-viewport";
import type { SurfaceFrame, SurfaceOverlayOptions } from "./surface-overlay";
import type { StaticUniformCache } from "./static-uniform-cache";

export function paintStaticOverlay(
  frame: SurfaceFrame,
  options: SurfaceOverlayOptions,
  cache: StaticUniformCache,
  reason: CaptureReason,
) {
  const { canvas, sourceBounds } = frame;
  const viewport = overlayViewport(
    canvas,
    options.element,
    sourceBounds ?? canvas.getBoundingClientRect(),
  );
  if (viewport.width < 1 || viewport.height < 1) return null;
  const result = cache.get(options, frame);
  result.renderer.render(result.profile, viewport, {
    x: viewport.x / canvas.width,
    y: 1 - (viewport.y + viewport.height) / canvas.height,
    width: viewport.width / canvas.width,
    height: viewport.height / canvas.height,
  });
  options.element.dataset.gradientBlurCache = result.hit ? "hit" : "miss";
  options.element.dataset.gradientBlurShared = result.key;
  return {
    ...createReadyMetrics({
      adapterId: frame.adapterId ?? "html-in-canvas",
      atlas: result.atlas,
      atlasBuildMs: result.atlasBuildMs,
      uploadMs: result.uploadMs,
      captureCount: frame.captureCount ?? 1,
      captureMs: frame.captureMs,
      mode: "uniform",
      strategy: options.strategy,
      liveCapture: "snapshot",
      pixelRatio: frame.pixelRatio,
      reason,
      sourceWidth: canvas.width,
      sourceHeight: canvas.height,
    }),
    sharedTexture: result.key,
  };
}
