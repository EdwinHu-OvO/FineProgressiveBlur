import type { CaptureReason, GradientBlurSourceMode } from "../types";
import type { BlurSurface } from "../engine/blur-surface";
import type { SurfaceOverlayOptions } from "../engine/surface-overlay";
import { SurfaceOverlays } from "../engine/surface-overlays";
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
  sourceMode: GradientBlurSourceMode;
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
  private readonly overlays: SurfaceOverlays;
  private ready = false;
  private disposed = false;
  private redraw = false;
  private scrollSensitive = false;
  private viewport = "";
  private selection = "";
  private sourceDirty = true;

  constructor(private readonly options: RitoSurfaceOptions) {
    this.host = new RitoHost(options.provider, options.source);
    try {
      this.scene = new RitoScene(this.host.canvas);
    } catch (error) {
      this.host.dispose();
      throw error;
    }
    this.queue = new FrameQueue(this.render, this.fail);
    this.overlays = new SurfaceOverlays(
      this.host.canvas,
      this.scene,
      options.sourceMode,
      () => {
        if (this.disposed) return;
        this.redraw = true;
        this.queue.request();
      },
    );
    this.interaction = new RitoInteraction(options.source, () => {
      if (options.sourceMode !== "static") this.queue.request();
    });
    this.detach = attachSurfaceEvents(options.source, this.host.canvas, {
      content: (change) => {
        if (change.kind === "fonts") this.resources.fontsChanged();
        if (change.kind === "image") this.resources.imageLoaded(change.element);
        if (options.sourceMode === "static") return;
        this.queue.request(true);
      },
      scroll: (nested) => {
        if (options.sourceMode !== "static")
          this.queue.request(nested || this.scrollSensitive);
      },
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
    if (reason === "manual") this.resources.invalidate();
    const requested = this.overlays.request(reason);
    if (reason === "scrollend" && !requested) return;
    this.redraw = true;
    if (reason !== "scrollend") this.sourceDirty = true;
    this.queue.request(reason !== "scrollend");
  }

  setRadius(element: HTMLElement, radius: number): void {
    if (!this.disposed) this.overlays.setRadius(element, radius);
  }

  requestOverlay(element: HTMLElement): void {
    if (!this.disposed) this.overlays.requestOverlay(element);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.queue.dispose();
    this.detach();
    this.interaction.dispose();
    this.overlays.dispose();
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
    if (this.options.sourceMode === "static") {
      if (this.ready && !this.sourceDirty) {
        if (this.redraw) this.paintOverlays(ratio, 0, false);
        return;
      }
      readContent = true;
    }
    this.sourceDirty = false;
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
      this.sourceDirty = true;
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
    this.paintOverlays(ratio, performance.now() - startedAt, contentChanged);
    this.host.show();
    if (!this.ready) {
      this.ready = true;
      this.options.onReady(this);
    }
  };

  private paintOverlays(
    ratio: number,
    captureMs: number,
    contentChanged: boolean,
  ) {
    const { source } = this.options;
    const canvas = this.host.canvas;
    this.scene.draw();
    canvas.dataset.ritoScrollTop = String(source.scrollTop);
    canvas.dataset.ritoScrollLeft = String(source.scrollLeft);
    this.overlays.paint({
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
        this.viewport,
        this.selection,
      ]),
    });
    this.redraw = false;
  }

  private fail = (error: unknown): void => {
    this.dispose();
    this.options.onFailure(error);
  };
}
