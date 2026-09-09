import type { CaptureReason } from "../types";
import type { BlurSurface } from "../engine/blur-surface";
import {
  SurfaceOverlay,
  type SurfaceOverlayOptions,
} from "../engine/surface-overlay";
import { DomResources } from "./dom-resources";
import { readDomScene } from "./dom-scene";
import { RitoHost } from "./rito-host";
import { RitoScene } from "./rito-scene";
import { RitoInteraction } from "./interaction";
import { FrameQueue } from "./frame-queue";
import { attachSurfaceEvents } from "./surface-events";

interface RitoSurfaceOptions {
  provider: HTMLElement;
  source: HTMLElement;
  maxPixelRatio: number;
  onReady(surface: RitoSurface): void;
  onFailure(error: unknown): void;
}

export class RitoSurface implements BlurSurface {
  private readonly host: RitoHost;
  private readonly scene: RitoScene;
  private readonly resources = new DomResources();
  private readonly interaction: RitoInteraction;
  private readonly queue: FrameQueue;
  private readonly detach: () => void;
  private readonly overlays = new Set<SurfaceOverlay>();
  private ready = false;
  private disposed = false;
  private redraw = false;
  private scrollSensitive = false;
  private viewport = "";
  private selection = "";

  constructor(private readonly options: RitoSurfaceOptions) {
    this.host = new RitoHost(options.provider, options.source);
    try {
      this.scene = new RitoScene(this.host.canvas);
    } catch (error) {
      this.host.dispose();
      throw error;
    }
    this.queue = new FrameQueue(this.render, this.fail);
    this.interaction = new RitoInteraction(options.source, () =>
      this.queue.request(),
    );
    this.detach = attachSurfaceEvents(options.source, this.host.canvas, {
      content: (change) => {
        if (change.kind === "fonts") this.resources.fontsChanged();
        if (change.kind === "image") this.resources.imageLoaded(change.element);
        this.queue.request(true);
      },
      scroll: (nested) => this.queue.request(nested || this.scrollSensitive),
      scrollEnd: () => this.request("scrollend"),
      resize: () => {
        this.request("resize");
        this.queue.request(true);
      },
      visible: (visible) => this.queue.setVisible(visible),
      lost: (event) => {
        event.preventDefault();
        this.fail(new Error("Rito WebGL context lost"));
      },
    });
    this.queue.request(true);
  }

  register(options: SurfaceOverlayOptions): () => void {
    if (this.disposed) return () => {};
    let overlay: SurfaceOverlay;
    try {
      overlay = new SurfaceOverlay(this.host.canvas, this.scene, options);
    } catch (error) {
      this.fail(error);
      return () => {};
    }
    this.overlays.add(overlay);
    const observer = new ResizeObserver(() => {
      overlay.request("resize");
      this.redraw = true;
      this.queue.request();
    });
    observer.observe(options.element);
    this.redraw = true;
    this.queue.request();
    return () => {
      observer.disconnect();
      if (this.overlays.delete(overlay)) overlay.dispose();
      this.redraw = true;
      this.queue.request();
    };
  }

  request(reason: CaptureReason): void {
    if (this.disposed) return;
    if (reason === "manual") this.resources.invalidate();
    let requested = false;
    for (const overlay of this.overlays) {
      if (reason === "scrollend" && overlay.options.strategy !== "scrollend")
        continue;
      overlay.request(reason);
      requested = true;
    }
    if (reason === "scrollend" && !requested) return;
    this.redraw = true;
    this.queue.request(reason !== "scrollend");
  }

  setRadius(element: HTMLElement, radius: number): void {
    for (const overlay of this.overlays) {
      if (overlay.options.element !== element) continue;
      overlay.options.maxRadius = radius;
      overlay.request("manual");
    }
    this.redraw = true;
    this.queue.request();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.queue.dispose();
    this.detach();
    this.interaction.dispose();
    for (const overlay of this.overlays) overlay.dispose();
    this.overlays.clear();
    this.resources.dispose();
    this.scene.dispose();
    this.host.dispose();
  }

  private render = async (
    readContent: boolean,
    signal: AbortSignal,
  ): Promise<void> => {
    const { source, maxPixelRatio } = this.options;
    if (source.clientWidth < 1 || source.clientHeight < 1) return;
    const ratio = Math.min(window.devicePixelRatio || 1, maxPixelRatio);
    const startedAt = performance.now();
    if (readContent || !this.ready) {
      if (!this.ready) await document.fonts.ready;
      const snapshot = await readDomScene(
        source,
        this.resources,
        signal,
        ratio,
      );
      this.scene.tiles.setScene(snapshot);
      this.scrollSensitive = snapshot.scrollSensitive;
      this.resources.retain(new Set(snapshot.images.keys()));
    }
    signal.throwIfAborted();
    const beforeScroll = [source.scrollLeft, source.scrollTop];
    this.host.resize(ratio);
    const resized = this.scene.resize();
    const changed = await this.scene.tiles.prepare(
      source.scrollTop,
      source.clientHeight,
      ratio,
      signal,
    );
    signal.throwIfAborted();
    if (
      source.scrollLeft !== beforeScroll[0] ||
      source.scrollTop !== beforeScroll[1]
    ) {
      this.queue.request();
      return;
    }
    const viewport = JSON.stringify([
      source.scrollLeft,
      source.scrollTop,
      source.clientWidth,
      source.clientHeight,
      ratio,
    ]);
    const layers = this.interaction.layers();
    const selection = JSON.stringify(layers);
    const contentChanged =
      changed ||
      resized ||
      viewport !== this.viewport ||
      selection !== this.selection;
    const canvas = this.host.canvas;
    canvas.dataset.ritoPaints = String(this.scene.tiles.paintCount);
    canvas.dataset.ritoCacheBytes = String(this.scene.tiles.retainedBytes);
    if (!contentChanged && !this.redraw && this.ready) return;
    this.viewport = viewport;
    this.selection = selection;
    if (contentChanged) this.scene.compose(source, ratio, layers);
    this.scene.draw();
    canvas.dataset.ritoScrollTop = String(source.scrollTop);
    canvas.dataset.ritoScrollLeft = String(source.scrollLeft);
    const captureMs = performance.now() - startedAt;
    for (const overlay of this.overlays)
      overlay.paint({
        canvas,
        scene: this.scene,
        source,
        pixelRatio: ratio,
        sourceBounds: canvas.getBoundingClientRect(),
        adapterId: "rito",
        captureCount: this.scene.tiles.paintCount,
        sourceUploadMs: this.scene.tiles.uploadMs,
        timestamp: performance.now(),
        captureMs,
        contentChanged,
        cacheKey: JSON.stringify([
          this.scene.tiles.contentVersion,
          viewport,
          selection,
          overlay.options.direction,
          overlay.options.maxRadius,
          overlay.options.algorithm ?? "compact9",
          overlay.options.blurCurve ?? null,
        ]),
      });
    this.redraw = false;
    this.host.show();
    if (!this.ready) {
      this.ready = true;
      this.options.onReady(this);
    }
  };

  private fail = (error: unknown): void => {
    this.dispose();
    this.options.onFailure(error);
  };
}
