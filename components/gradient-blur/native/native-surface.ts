import type { CaptureReason, GradientBlurSourceMode } from "../types";
import { attachScrollEvents } from "../capture/scroll-events";
import { NativeHost } from "./native-host";
import type { SurfaceOverlayOptions } from "../engine/surface-overlay";
import { SurfaceOverlays } from "../engine/surface-overlays";
import { NativeScene } from "./native-scene";

export interface NativeSurfaceOptions {
  provider: HTMLDivElement;
  resolveSource(): HTMLElement | null;
  maxPixelRatio: number;
  sourceMode: GradientBlurSourceMode;
  onReady(surface: NativeSurface): void;
  onFailure(error: unknown): void;
}

/** Owns Provider paint timing, shared texture capture and overlay lifetimes. */
export class NativeSurface {
  private readonly host: NativeHost;
  private readonly scene: NativeScene;
  private readonly overlays: SurfaceOverlays;
  private readonly resizeObserver: ResizeObserver;
  private readonly intersectionObserver: IntersectionObserver;
  private readonly detachScroll: () => void;
  private initialTimer: ReturnType<typeof setTimeout> | null = null;
  private visible = true;
  private ready = false;
  private disposed = false;
  private redrawRequested = true;
  private captureRequested = true;
  private captureCount = 0;

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
    this.overlays = new SurfaceOverlays(
      this.host.canvas,
      this.scene,
      options.sourceMode,
      () => {
        if (this.disposed) return;
        this.redrawRequested = true;
        this.host.canvas.requestPaint();
      },
    );
    this.resizeObserver = new ResizeObserver(() => this.request("resize"));
    this.resizeObserver.observe(options.provider);
    const source = options.resolveSource();
    if (source) this.resizeObserver.observe(source);
    this.intersectionObserver = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      if (this.visible) this.resume();
    });
    this.intersectionObserver.observe(options.provider);
    this.host.canvas.addEventListener("paint", this.paint);
    this.host.canvas.addEventListener("webglcontextlost", this.contextLost);
    this.detachScroll = attachScrollEvents(options.provider, {
      onScroll: () => {
        if (options.sourceMode === "static") return;
        this.overlays.scroll();
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
    try {
      return this.overlays.register(options);
    } catch (error) {
      this.fail(error);
      return () => {};
    }
  }

  request(reason: CaptureReason): void {
    if (this.disposed) return;
    if (reason === "scrollend" && this.options.sourceMode === "static") return;
    const requested = this.overlays.request(reason);
    if (reason === "scrollend" && !requested) return;
    this.redrawRequested = true;
    if (reason === "manual" || reason === "resize")
      this.captureRequested = true;
    this.host.resize(this.pixelRatio);
    this.host.canvas.requestPaint();
  }

  setRadius(element: HTMLElement, radius: number): void {
    if (this.disposed) return;
    this.overlays.setRadius(element, radius);
  }

  requestOverlay(element: HTMLElement): void {
    if (!this.disposed) this.overlays.requestOverlay(element);
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
    this.overlays.dispose();
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
      this.captureRequested ||
      this.scene.needsResize ||
      !this.ready ||
      (this.options.sourceMode !== "static" &&
        (!changed || changed.includes(this.host.drawable)));
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
      if (contentChanged) {
        this.scene.capture(this.host.drawable);
        this.captureRequested = false;
        this.captureCount++;
      }
      const captureMs = performance.now() - startedAt;
      this.scene.draw();
      const timestamp = performance.now();
      this.overlays.paint({
        canvas: this.host.canvas,
        scene: this.scene,
        source,
        captureMs,
        timestamp,
        pixelRatio: this.pixelRatio,
        contentChanged,
        captureCount: this.captureCount,
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
    if (document.visibilityState !== "hidden") this.resume();
  };

  private resume(): void {
    if (this.options.sourceMode !== "static") this.request("manual");
    else {
      this.redrawRequested = true;
      this.host.canvas.requestPaint();
    }
  }

  private contextLost = (event: Event): void => {
    event.preventDefault();
    this.fail(new Error("Native WebGL context lost"));
  };

  private fail(error: unknown): void {
    this.dispose();
    this.options.onFailure(error);
  }
}
