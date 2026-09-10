import type { CaptureReason, GradientBlurSourceMode } from "../types";
import type { SceneTexture } from "./blur-surface";
import {
  SurfaceOverlay,
  type SurfaceFrame,
  type SurfaceOverlayOptions,
} from "./surface-overlay";
import { StaticUniformCache } from "./static-uniform-cache";

/** Shared overlay lifetime, local invalidation and static texture ownership. */
export class SurfaceOverlays {
  private readonly overlays = new Set<SurfaceOverlay>();
  private readonly observers = new Set<ResizeObserver>();
  private readonly uniformCache?: StaticUniformCache;
  private disposed = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly scene: SceneTexture,
    sourceMode: GradientBlurSourceMode,
    private readonly redraw: () => void,
  ) {
    if (sourceMode === "static") this.uniformCache = new StaticUniformCache();
  }

  register(options: SurfaceOverlayOptions): () => void {
    if (this.disposed) return () => {};
    const overlay = new SurfaceOverlay(this.canvas, this.scene, options);
    this.overlays.add(overlay);
    const observer = new ResizeObserver(() =>
      this.requestOverlay(options.element),
    );
    this.observers.add(observer);
    observer.observe(options.element);
    this.redraw();
    return () => {
      observer.disconnect();
      this.observers.delete(observer);
      if (this.overlays.delete(overlay)) overlay.dispose();
      if (!this.disposed) this.redraw();
    };
  }

  request(reason: CaptureReason): boolean {
    let requested = false;
    for (const overlay of this.overlays) {
      if (reason === "scrollend" && overlay.options.strategy !== "scrollend")
        continue;
      overlay.request(reason);
      requested = true;
    }
    return requested;
  }

  requestOverlay(element: HTMLElement) {
    for (const overlay of this.overlays)
      if (overlay.options.element === element) overlay.request("resize");
    this.redraw();
  }

  setRadius(element: HTMLElement, radius: number) {
    for (const overlay of this.overlays) {
      if (overlay.options.element !== element) continue;
      overlay.options.maxRadius = radius;
      overlay.request("manual");
    }
    this.redraw();
  }

  scroll() {
    for (const overlay of this.overlays) {
      if (overlay.options.strategy === "live") overlay.request("live");
      else overlay.invalidate();
    }
  }

  paint(frame: SurfaceFrame) {
    this.uniformCache?.beginFrame(frame.contentChanged);
    for (const overlay of this.overlays) {
      overlay.paint({
        ...frame,
        staticUniformCache: this.uniformCache,
        cacheKey:
          frame.cacheKey &&
          JSON.stringify([
            frame.cacheKey,
            overlay.options.direction,
            overlay.options.maxRadius,
            overlay.options.algorithm ?? "compact9",
            overlay.options.blurCurve ?? null,
          ]),
      });
    }
    this.uniformCache?.endFrame();
    if (this.uniformCache)
      this.canvas.dataset.gradientBlurSharedTextures = String(
        this.uniformCache.size,
      );
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const observer of this.observers) observer.disconnect();
    this.observers.clear();
    for (const overlay of this.overlays) overlay.dispose();
    this.overlays.clear();
    this.uniformCache?.clear();
  }
}
