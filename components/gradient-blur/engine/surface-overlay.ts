import { OverlayRenderer } from "./OverlayRenderer";
import { overlayViewport } from "./overlay-viewport";
import { overlayCapture } from "./overlay-capture";
import { resolveOverlayMode, type OverlayRenderProfile } from "./overlay-mode";
import type { ResolvedBlurMask } from "../mask/types";
import { createReadyMetrics } from "./metrics";
import { RenderMetrics } from "./render-metrics";
import type {
  CaptureReason,
  CaptureStrategy,
  GradientBlurMetrics,
  GradientBlurPhase,
} from "../types";
import type { SceneTexture } from "./blur-surface";
import type { StaticUniformCache } from "./static-uniform-cache";
import { paintStaticOverlay } from "./static-overlay";

export interface SurfaceOverlayOptions extends OverlayRenderProfile {
  mask?: ResolvedBlurMask;
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
  staticUniformCache?: StaticUniformCache;
}

export class SurfaceOverlay {
  private activeRenderer?: OverlayRenderer;
  private readonly cachedRenderers = new Map<string, OverlayRenderer>();
  private readonly metrics: RenderMetrics;
  private pending: CaptureReason | null = "initial";
  private valid = false;
  private count = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly scene: SceneTexture,
    readonly options: SurfaceOverlayOptions,
  ) {
    this.metrics = new RenderMetrics(options.onMetrics);
  }

  private get renderer() {
    return (this.activeRenderer ??= new OverlayRenderer(
      this.canvas,
      this.scene.gl,
      this.options.mask,
    ));
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
    const mode = resolveOverlayMode(direction, this.options.mask);
    const sourceBounds = frame.sourceBounds ?? source.getBoundingClientRect();
    const overlayBounds = element.getBoundingClientRect();
    const capture = overlayCapture(
      canvas,
      sourceBounds,
      overlayBounds,
      this.options,
      mode !== "gradient",
    );
    if (!capture) return;
    const pixelRatio = frame.pixelRatio;
    const reason =
      this.pending ??
      (frame.contentChanged && strategy === "live" ? "live" : null);
    if (frame.contentChanged && strategy !== "live" && !reason)
      this.invalidate();

    if (mode === "uniform" && frame.staticUniformCache) {
      if (!reason && !this.valid) return;
      const metrics = paintStaticOverlay(
        frame,
        this.options,
        frame.staticUniformCache,
        reason ?? "resize",
      );
      if (!metrics) return;
      this.metrics.latest = metrics;
      if (!this.valid) this.options.onPhase("ready");
      this.valid = true;
      this.pending = null;
      this.metrics.record(timestamp);
      this.metrics.publish(Boolean(reason && reason !== "live"), timestamp);
      return;
    }
    delete element.dataset.gradientBlurShared;

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
    const wasValid = this.valid;
    if (reason && !cacheHit) {
      const startedAt = performance.now();
      const sourceWidth = capture.width;
      const sourceHeight = capture.height;
      const atlas = renderer.createLayout(
        sourceWidth,
        sourceHeight,
        this.options,
        pixelRatio,
        capture.sampleRegion,
      );
      const atlasBuildMs = performance.now() - startedAt;
      const uploadStartedAt = performance.now();
      renderer.uploadGpuAtlas(
        scene.framebuffer,
        capture.crop,
        atlas,
        this.options,
        capture.view,
      );
      this.metrics.latest = createReadyMetrics({
        adapterId: frame.adapterId ?? "html-in-canvas",
        atlas,
        atlasBuildMs,
        sampleCount: 9,
        captureCount: frame.captureCount ?? ++this.count,
        captureMs: frame.captureMs,
        direction,
        mode,
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
      this.valid = true;
    }
    if (this.draw(canvas, frame.sourceBounds, renderer)) {
      if (!wasValid) this.options.onPhase("ready");
      this.metrics.record(timestamp);
    }
    this.metrics.publish(Boolean(reason && reason !== "live"), timestamp);
  }

  draw(
    canvas: HTMLCanvasElement,
    sourceBounds?: DOMRect,
    renderer = this.renderer,
  ): boolean {
    if (!this.valid) return false;
    renderer.render(
      this.options,
      overlayViewport(canvas, this.options.element, sourceBounds),
    );
    return true;
  }

  dispose(): void {
    this.options.onPhase("fallback");
    this.activeRenderer?.dispose();
    for (const renderer of this.cachedRenderers.values()) renderer.dispose();
    this.cachedRenderers.clear();
  }

  private rendererFor(cacheKey: string): OverlayRenderer {
    const cached = this.cachedRenderers.get(cacheKey);
    if (cached) {
      this.cachedRenderers.delete(cacheKey);
      this.cachedRenderers.set(cacheKey, cached);
      return cached;
    }
    const renderer = new OverlayRenderer(
      this.canvas,
      this.renderer.gl,
      this.options.mask,
    );
    this.cachedRenderers.set(cacheKey, renderer);
    while (this.cachedRenderers.size > 3) {
      const oldest = this.cachedRenderers.entries().next().value as
        [string, OverlayRenderer] | undefined;
      if (!oldest) break;
      oldest[1].dispose();
      this.cachedRenderers.delete(oldest[0]);
    }
    return renderer;
  }
}
