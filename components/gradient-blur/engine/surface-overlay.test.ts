import { beforeEach, describe, expect, it, vi } from "vitest";
import { SurfaceOverlay, type SurfaceFrame } from "./surface-overlay";

const renderer = vi.hoisted(() => ({ render: vi.fn() }));
vi.mock("./GradientBlurRenderer", () => ({
  GradientBlurRenderer: class {
    render = renderer.render;
    uploadGpuAtlas() {}
    dispose() {}
  },
}));

function createOverlay() {
  const bounds = {
    left: 0,
    top: 0,
    right: 100,
    bottom: 40,
    width: 100,
    height: 40,
  } as DOMRect;
  const element = {
    dataset: {},
    getBoundingClientRect: () => bounds,
  } as unknown as HTMLElement;
  const canvas = {
    width: 100,
    height: 40,
    getBoundingClientRect: () => bounds,
  } as HTMLCanvasElement;
  const scene = {
    gl: {} as WebGL2RenderingContext,
    framebuffer: {} as WebGLFramebuffer,
  };
  const onPhase = vi.fn();
  const overlay = new SurfaceOverlay(canvas, scene, {
    element,
    direction: "top",
    maxRadius: 12,
    strategy: "scrollend",
    onPhase,
    onMetrics: vi.fn(),
  });
  const frame: SurfaceFrame = {
    canvas,
    scene,
    source: element,
    pixelRatio: 1,
    timestamp: 0,
    captureMs: 0,
    contentChanged: true,
  };
  return { overlay, frame, onPhase };
}

describe("overlay enhancement readiness", () => {
  beforeEach(() => {
    renderer.render.mockReset();
  });

  it("announces readiness only after successfully drawing the blur", () => {
    const { overlay, frame, onPhase } = createOverlay();
    renderer.render.mockImplementation(() => {
      expect(onPhase).not.toHaveBeenCalled();
    });
    overlay.paint(frame);
    expect(onPhase).toHaveBeenCalledExactlyOnceWith("ready");
    overlay.dispose();
  });

  it("does not disable fallback if the first draw fails", () => {
    const { overlay, frame, onPhase } = createOverlay();
    renderer.render.mockImplementation(() => {
      throw new Error("draw failed");
    });
    expect(() => overlay.paint(frame)).toThrow("draw failed");
    expect(onPhase).not.toHaveBeenCalled();
    overlay.dispose();
  });

  it("restores fallback for invalid frames and disposal", () => {
    const { overlay, frame, onPhase } = createOverlay();
    overlay.paint(frame);
    onPhase.mockClear();
    overlay.invalidate();
    overlay.paint(frame);
    expect(onPhase.mock.calls).toEqual([["capturing"], ["capturing"]]);
    overlay.request("scrollend");
    overlay.paint(frame);
    expect(onPhase).toHaveBeenLastCalledWith("ready");
    overlay.dispose();
    expect(onPhase).toHaveBeenLastCalledWith("fallback");
  });
});
