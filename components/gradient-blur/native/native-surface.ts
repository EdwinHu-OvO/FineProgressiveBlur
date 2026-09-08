import type { CaptureReason } from "../types";
import { attachScrollEvents } from "../capture/scroll-events";
import { NativeHost } from "./native-host";
import {
  SurfaceOverlay,
  type SurfaceOverlayOptions,
} from "../engine/surface-overlay";
import { NativeScene } from "./native-scene";

export interface NativeSurfaceOptions {
  provider: HTMLDivElement;
  resolveSource(): HTMLElement | null;
  maxPixelRatio: number;
  onReady(surface: NativeSurface): void;
  onFailure(error: unknown): void;
}

/** Owns Provider paint timing, shared texture capture and overlay lifetimes. */
export class NativeSurface {
  private readonly host: NativeHost;
  private readonly scene: NativeScene;
  private readonly overlays = new Set<SurfaceOverlay>();
  private readonly resizeObserver: ResizeObserver;
  private readonly intersectionObserver: IntersectionObserver;
  private readonly detachScroll: () => void;
  private initialTimer: ReturnType<typeof setTimeout> | null = null;
  private visible = true;
  private ready = false;
  private disposed = false;
  private redrawRequested = true;

  constructor(private readonly options: NativeSurfaceOptions) {
    const sourceBeforeHost = options.resolveSource();
    const scrollBeforeHost = sourceBeforeHost
      ? [sourceBeforeHost.scrollLeft, sourceBeforeHost.scrollTop]
      : null;
    this.host = new NativeHost(options.provider);
    try {
      this.scene = new NativeScene(this.host.canvas);
    } catch (error) {
      this.host.dispose();
      throw error;
    }
    this.resizeObserver = new ResizeObserver(() => this.request("resize"));
    this.resizeObserver.observe(options.provider);
    const source = options.resolveSource();
    if (source) this.resizeObserver.observe(source);
    this.intersectionObserver = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      if (this.visible) this.request("manual");
    });
    this.intersectionObserver.observe(options.provider);
    this.host.canvas.addEventListener("paint", this.paint);
    this.host.canvas.addEventListener("webglcontextlost", this.contextLost);
    this.detachScroll = attachScrollEvents(options.provider, {
      onScroll: () => {
        for (const overlay of this.overlays) {
          if (overlay.options.strategy === "live") overlay.request("live");
          else overlay.invalidate();
        }
        // requestPaint delivers a fresh layout snapshot; rAF can be too early.
        this.host.canvas.requestPaint();
      },
      onScrollEnd: () => this.request("scrollend"),
    });
    document.addEventListener("visibilitychange", this.visibility);
    this.initialTimer = setTimeout(
      () => this.fail(new Error("HTML-in-Canvas paint timed out")),
      1500,
    );
    this.request("initial");
    // The drawable has no layout size until request() resizes the host.
    // Restoring earlier clamps scroll offsets to zero in Chromium.
    if (sourceBeforeHost && scrollBeforeHost) {
      sourceBeforeHost.scrollLeft = scrollBeforeHost[0];
      sourceBeforeHost.scrollTop = scrollBeforeHost[1];
      this.host.canvas.requestPaint();
    }
  }

  register(options: SurfaceOverlayOptions): () => void {
    if (this.disposed) return () => {};
    if (options.element.parentElement !== this.options.provider) {
      this.fail(
        new Error("Native overlays must be direct children of the Provider"),
      );
      return () => {};
    }
    let overlay: SurfaceOverlay;
    try {
      overlay = new SurfaceOverlay(this.host.canvas, this.scene, options);
    } catch (error) {
      this.fail(error);
      return () => {};
    }
    this.overlays.add(overlay);
    this.resizeObserver.observe(options.element);
    this.request("initial");
    return () => {
      this.resizeObserver.unobserve(options.element);
      this.overlays.delete(overlay);
      this.redrawRequested = true;
      overlay.dispose();
      if (!this.disposed) this.host.canvas.requestPaint();
    };
  }

  request(reason: CaptureReason): void {
    if (this.disposed) return;
    let requested = false;
    for (const overlay of this.overlays) {
      if (reason !== "scrollend" || overlay.options.strategy === "scrollend") {
        overlay.request(reason);
        requested = true;
      }
    }
    if (reason === "scrollend" && !requested) return;
    this.redrawRequested = true;
    this.host.resize(this.pixelRatio);
    this.host.canvas.requestPaint();
  }

  setRadius(element: HTMLElement, radius: number): void {
    if (this.disposed) return;
    this.redrawRequested = true;
    for (const overlay of this.overlays) {
      if (overlay.options.element === element) {
        overlay.options.maxRadius = radius;
        overlay.request("manual");
      }
    }
    // Radius changes also change LOD boundaries, so rebuild in the next paint.
    this.host.canvas.requestPaint();
  }

  dispose(): void {
    if (this.disposed) return;
    const source = this.options.resolveSource();
    const scroll = source ? [source.scrollLeft, source.scrollTop] : null;
    this.disposed = true;
    if (this.initialTimer) clearTimeout(this.initialTimer);
    this.resizeObserver.disconnect();
    this.intersectionObserver.disconnect();
    this.host.canvas.removeEventListener("paint", this.paint);
    this.host.canvas.removeEventListener("webglcontextlost", this.contextLost);
    this.detachScroll();
    document.removeEventListener("visibilitychange", this.visibility);
    // React owns layer cleanup; releasing shared scene storage is independent.
    this.scene.dispose();
    this.host.dispose();
    if (source && scroll) {
      source.scrollLeft = scroll[0];
      source.scrollTop = scroll[1];
      queueMicrotask(() => {
        source.scrollLeft = scroll[0];
        source.scrollTop = scroll[1];
      });
    }
  }

  private get pixelRatio(): number {
    return Math.min(window.devicePixelRatio || 1, this.options.maxPixelRatio);
  }

  private paint = (event: Event): void => {
    if (this.disposed || !this.visible || document.visibilityState === "hidden")
      return;
    // This is the browser's recorded drawable content, not a DOM mutation hint.
    const changed = (event as Event & { changedElements?: readonly Element[] })
      .changedElements;
    const contentChanged =
      !this.ready || !changed || changed.includes(this.host.drawable);
    if (!contentChanged && !this.redrawRequested) return;
    try {
      const source = this.options.resolveSource();
      if (
        !source ||
        source === this.options.provider ||
        !this.options.provider.contains(source)
      ) {
        throw new Error("Native capture requires a source inside the Provider");
      }
      const startedAt = performance.now();
      if (contentChanged || this.scene.needsResize)
        this.scene.capture(this.host.drawable);
      const captureMs = performance.now() - startedAt;
      this.scene.draw();
      const timestamp = performance.now();
      for (const overlay of this.overlays)
        overlay.paint({
          canvas: this.host.canvas,
          scene: this.scene,
          source,
          captureMs,
          timestamp,
          pixelRatio: this.pixelRatio,
          contentChanged,
        });
      this.redrawRequested = false;
      if (!this.ready) {
        this.ready = true;
        if (this.initialTimer) clearTimeout(this.initialTimer);
        this.options.onReady(this);
      }
    } catch (error) {
      this.fail(error);
    }
  };

  private visibility = (): void => {
    if (document.visibilityState !== "hidden") this.request("manual");
  };

  private contextLost = (event: Event): void => {
    event.preventDefault();
    this.fail(new Error("Native WebGL context lost"));
  };

  private fail(error: unknown): void {
    this.dispose();
    this.options.onFailure(error);
  }
}
