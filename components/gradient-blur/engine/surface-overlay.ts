import { createAtlasLayout } from "./atlas-layout";
import { GradientBlurRenderer } from "./GradientBlurRenderer";
import { createReadyMetrics } from "./metrics";
import { RenderMetrics } from "./render-metrics";
import type {
  CaptureReason,
  CaptureStrategy,
  GradientBlurMetrics,
  GradientBlurProfile,
  GradientBlurPhase,
} from "../types";
import type { SceneTexture } from "./blur-surface";

export interface SurfaceOverlayOptions extends GradientBlurProfile {
  element: HTMLElement;
  strategy: CaptureStrategy;
  onPhase(phase: GradientBlurPhase): void;
  onMetrics(metrics: GradientBlurMetrics): void;
}

export interface SurfaceFrame {
  adapterId?: string;
  captureCount?: number;
  sourceUploadMs?: number;
  sourceBounds?: DOMRect;
  canvas: HTMLCanvasElement;
  source: HTMLElement;
  scene: SceneTexture;
  pixelRatio: number;
  timestamp: number;
  captureMs: number;
  contentChanged: boolean;
  /** Stable document-window identity supplied by tile-backed surfaces. */
  cacheKey?: string;
}

export class SurfaceOverlay {
  private readonly renderer: GradientBlurRenderer;
  private readonly cachedRenderers = new Map<string, GradientBlurRenderer>();
  private readonly metrics: RenderMetrics;
  private pending: CaptureReason | null = "initial";
  private valid = false;
  private count = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    scene: SceneTexture,
    readonly options: SurfaceOverlayOptions,
  ) {
    this.metrics = new RenderMetrics(options.onMetrics);
    this.renderer = new GradientBlurRenderer(canvas, scene.gl);
  }

  request(reason: CaptureReason): void {
    this.pending = reason;
  }

  invalidate(): void {
    this.pending = null;
    this.valid = false;
    this.options.onPhase("capturing");
  }

  paint(frame: SurfaceFrame): void {
    const { canvas, source, scene, timestamp } = frame;
    const { element, direction, strategy } = this.options;
    const canvasBounds = canvas.getBoundingClientRect();
    const sourceBounds = frame.sourceBounds ?? source.getBoundingClientRect();
    const overlayBounds = element.getBoundingClientRect();
    const width = Math.min(overlayBounds.width, sourceBounds.width);
    const height = Math.min(overlayBounds.height, sourceBounds.height);
    if (width <= 0 || height <= 0) return;
    const scaleX = canvas.width / canvasBounds.width;
    const scaleY = canvas.height / canvasBounds.height;
    const pixelRatio = frame.pixelRatio;
    const reason =
      this.pending ??
      (frame.contentChanged && strategy === "live" ? "live" : null);
    if (frame.contentChanged && strategy !== "live" && !reason)
      this.invalidate();

    // Rito's live path moves the viewport on every scroll event. Its cache key
    // therefore changes every frame and would churn GPU programs and targets;
    // keep one renderer for the moving frame while still updating its atlas.
    const cacheKey =
      strategy === "live" && frame.adapterId !== "rito"
        ? frame.cacheKey
        : undefined;
    const cacheHit = Boolean(cacheKey && this.cachedRenderers.has(cacheKey));
    const renderer = cacheKey ? this.rendererFor(cacheKey) : this.renderer;
    element.dataset.gradientBlurCache = cacheHit ? "hit" : "miss";
    if (reason && !cacheHit) {
      const startedAt = performance.now();
      const sourceWidth = Math.max(1, Math.round(width * pixelRatio));
      const sourceHeight = Math.max(1, Math.round(height * pixelRatio));
      const atlas = createAtlasLayout(
        sourceWidth,
        sourceHeight,
        this.options.maxRadius,
        pixelRatio,
        this.options.blurCurve,
      );
      const atlasBuildMs = performance.now() - startedAt;
      const uploadStartedAt = performance.now();
      renderer.uploadGpuAtlas(
        scene.framebuffer,
        {
          x: (sourceBounds.left - canvasBounds.left) * scaleX,
          y:
            (sourceBounds.top -
              canvasBounds.top +
              (direction === "bottom" ? sourceBounds.height - height : 0)) *
            scaleY,
          width: width * scaleX,
          height: height * scaleY,
        },
        atlas,
        this.options,
        { width, height },
      );
      this.metrics.latest = createReadyMetrics({
        adapterId: frame.adapterId ?? "html-in-canvas",
        atlas,
        atlasBuildMs,
        sampleCount: 9,
        captureCount: frame.captureCount ?? ++this.count,
        captureMs: frame.captureMs,
        direction,
        strategy,
        liveCapture: strategy === "live" ? "continuous" : "snapshot",
        pixelRatio,
        renderCount: this.metrics.latest?.renderCount ?? 0,
        renderFps: this.metrics.latest?.renderFps ?? 0,
        reason,
        sourceHeight,
        sourceWidth,
        uploadMs:
          (frame.sourceUploadMs ?? 0) + performance.now() - uploadStartedAt,
      });
      this.pending = null;
      if (!this.valid) this.options.onPhase("ready");
      this.valid = true;
    }
    if (this.draw(canvas, frame.sourceBounds, renderer))
      this.metrics.record(timestamp);
    this.metrics.publish(Boolean(reason && reason !== "live"), timestamp);
  }

  draw(
    canvas: HTMLCanvasElement,
    sourceBounds?: DOMRect,
    renderer = this.renderer,
  ): boolean {
    if (!this.valid) return false;
    const bounds = canvas.getBoundingClientRect();
    const overlay = this.options.element.getBoundingClientRect();
    const region = sourceBounds
      ? {
          left: Math.max(overlay.left, sourceBounds.left),
          bottom: Math.min(overlay.bottom, sourceBounds.bottom),
          width: Math.max(
            0,
            Math.min(overlay.right, sourceBounds.right) -
              Math.max(overlay.left, sourceBounds.left),
          ),
          height: Math.max(
            0,
            Math.min(overlay.bottom, sourceBounds.bottom) -
              Math.max(overlay.top, sourceBounds.top),
          ),
        }
      : overlay;
    const scaleX = canvas.width / bounds.width;
    const scaleY = canvas.height / bounds.height;
    renderer.render(this.options, {
      x: Math.round((region.left - bounds.left) * scaleX),
      y: Math.round((bounds.bottom - region.bottom) * scaleY),
      width: Math.round(region.width * scaleX),
      height: Math.round(region.height * scaleY),
    });
    return true;
  }

  dispose(): void {
    this.renderer.dispose();
    for (const renderer of this.cachedRenderers.values()) renderer.dispose();
    this.cachedRenderers.clear();
  }

  private rendererFor(cacheKey: string): GradientBlurRenderer {
    const cached = this.cachedRenderers.get(cacheKey);
    if (cached) {
      this.cachedRenderers.delete(cacheKey);
      this.cachedRenderers.set(cacheKey, cached);
      return cached;
    }
    const renderer = new GradientBlurRenderer(this.canvas, this.renderer.gl);
    this.cachedRenderers.set(cacheKey, renderer);
    while (this.cachedRenderers.size > 3) {
      const oldest = this.cachedRenderers.entries().next().value as
        | [string, GradientBlurRenderer]
        | undefined;
      if (!oldest) break;
      oldest[1].dispose();
      this.cachedRenderers.delete(oldest[0]);
    }
    return renderer;
  }
}
