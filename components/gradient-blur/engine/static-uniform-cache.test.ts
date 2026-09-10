import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StaticUniformCache } from "./static-uniform-cache";
import { paintStaticOverlay } from "./static-overlay";
import type { SurfaceFrame, SurfaceOverlayOptions } from "./surface-overlay";

const renderers = vi.hoisted(() => ({
  instances: [] as Array<{
    uploadGpuAtlas: ReturnType<typeof vi.fn>;
    render: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
  }>,
}));
vi.mock("./GradientBlurRenderer", () => ({
  GradientBlurRenderer: class {
    uploadGpuAtlas = vi.fn();
    render = vi.fn();
    dispose = vi.fn();
    constructor() {
      renderers.instances.push(this);
    }
  },
}));

const bounds = (left: number, top: number, width: number, height: number) =>
  ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  }) as DOMRect;
const sourceBounds = bounds(10, 20, 400, 300);
const canvas = {
  width: 800,
  height: 600,
  getBoundingClientRect: () => sourceBounds,
} as HTMLCanvasElement;
const frame: SurfaceFrame = {
  canvas,
  source: {} as HTMLElement,
  sourceBounds,
  scene: {
    gl: {} as WebGL2RenderingContext,
    framebuffer: {} as WebGLFramebuffer,
  },
  pixelRatio: 2,
  timestamp: 0,
  captureMs: 0,
  contentChanged: false,
};
let cache: StaticUniformCache;
beforeEach(() => {
  renderers.instances.length = 0;
  cache = new StaticUniformCache();
});
afterEach(() => cache.clear());

describe("Provider static uniform results", () => {
  it("captures the full source once and crops the same result for differently sized overlays", () => {
    let rect = bounds(50, 80, 100, 75);
    const element = {
      dataset: {},
      getBoundingClientRect: () => rect,
    } as HTMLElement;
    const options: SurfaceOverlayOptions = {
      element,
      maxRadius: 24,
      strategy: "live",
      onPhase: vi.fn(),
      onMetrics: vi.fn(),
    };
    cache.beginFrame(false);
    const first = paintStaticOverlay(frame, options, cache, "initial");
    rect = bounds(210, 140, 200, 180);
    const second = paintStaticOverlay(frame, options, cache, "resize");
    expect(first?.sharedTexture).toBe(second?.sharedTexture);
    expect(first?.sourceBytes).toBe(800 * 600 * 4);
    expect(renderers.instances).toHaveLength(1);
    const renderer = renderers.instances[0];
    expect(renderer.uploadGpuAtlas).toHaveBeenCalledTimes(1);
    expect(renderer.uploadGpuAtlas.mock.calls[0][1]).toEqual({
      x: 0,
      y: 0,
      width: 800,
      height: 600,
    });
    expect(renderer.render.mock.calls[0]).toEqual([
      expect.objectContaining({ uniformRadius: true, materialize: true }),
      { x: 80, y: 330, width: 200, height: 150 },
      { x: 0.1, y: expect.closeTo(0.2, 8), width: 0.25, height: 0.25 },
    ]);
    expect(renderer.render.mock.calls[1][2]).toEqual({
      x: 0.5,
      y: 0.4,
      width: 0.5,
      height: 0.6,
    });
  });

  it("clips overlays crossing the source boundary without stretching the source", () => {
    const element = {
      dataset: {},
      getBoundingClientRect: () => bounds(-30, -20, 100, 80),
    } as HTMLElement;
    const options: SurfaceOverlayOptions = {
      element,
      maxRadius: 4,
      strategy: "live",
      onPhase: vi.fn(),
      onMetrics: vi.fn(),
    };
    paintStaticOverlay(frame, options, cache, "initial");
    const call = renderers.instances[0].render.mock.calls[0];
    expect(call[1]).toEqual({ x: 0, y: 520, width: 120, height: 80 });
    expect(call[2]).toEqual({ x: 0, y: 0, width: 0.15, height: 80 / 600 });
  });

  it("shares only equal profiles and invalidates all results when the source changes", () => {
    const first = cache.get({ maxRadius: 24 }, frame);
    cache.get({ maxRadius: 48 }, frame);
    cache.beginFrame(false);
    expect(cache.get({ maxRadius: 24 }, frame).hit).toBe(true);
    expect(renderers.instances).toHaveLength(2);
    cache.beginFrame(true);
    expect(
      renderers.instances.every(
        (renderer) => renderer.dispose.mock.calls.length === 1,
      ),
    ).toBe(true);
    const refreshed = cache.get({ maxRadius: 24 }, frame);
    expect(refreshed.hit).toBe(false);
    expect(refreshed.key).not.toBe(first.key);
  });

  it("bounds unused radius history while retaining currently shared profiles", () => {
    for (let radius = 0; radius < 12; radius++) {
      cache.beginFrame(false);
      cache.get({ maxRadius: radius }, frame);
      cache.endFrame();
    }
    expect(cache.size).toBeLessThanOrEqual(4);
    expect(cache.get({ maxRadius: 11 }, frame).hit).toBe(true);
    expect(
      renderers.instances.some(
        (renderer) => renderer.dispose.mock.calls.length === 1,
      ),
    ).toBe(true);
  });
});
