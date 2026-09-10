import { beforeEach, describe, expect, it, vi } from "vitest";
import { OverlayRenderer } from "./OverlayRenderer";

const calls = vi.hoisted(() => ({
  gradient: { upload: vi.fn(), render: vi.fn() },
  mask: { create: vi.fn(), layout: vi.fn(), upload: vi.fn(), render: vi.fn() },
}));
vi.mock("./GradientBlurRenderer", () => ({
  GradientBlurRenderer: class {
    uploadGpuAtlas = calls.gradient.upload;
    render = calls.gradient.render;
    dispose() {}
  },
}));
vi.mock("../mask/MaskBlurRenderer", () => ({
  MaskBlurRenderer: class {
    constructor() {
      calls.mask.create();
    }
    createLayout = calls.mask.layout;
    upload = calls.mask.upload;
    render = calls.mask.render;
    dispose() {}
  },
}));

const canvas = { width: 800, height: 600 } as HTMLCanvasElement;
const gl = {} as WebGL2RenderingContext;
const source = {} as WebGLFramebuffer;
const curve = { x1: 0.8, y1: 0.1, x2: 0.9, y2: 0.8 };

describe("overlay pipeline selection", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses one radius-dependent block and constant convolution without selectors", () => {
    const renderer = new OverlayRenderer(canvas, gl);
    for (const [dpr, expectedScales] of [
      [1, [1, 1, 0.125, 0.0625]],
      [2, [1, 0.5, 0.0625, 0.03125]],
    ] as const) {
      [0, 4, 24, 48].forEach((maxRadius, index) => {
        const profile = { maxRadius, blurCurve: curve };
        const atlas = renderer.createLayout(800, 600, profile, dpr);
        expect(atlas.bands).toHaveLength(1);
        expect(atlas.bands[0]).toMatchObject({
          scale: expectedScales[index],
          captureStart: 0,
          captureEnd: 1,
        });
        renderer.render(profile);
        expect(calls.gradient.render).toHaveBeenLastCalledWith(
          expect.objectContaining({
            maxRadius,
            uniformRadius: true,
            blurCurve: undefined,
          }),
          undefined,
        );
      });
    }
    expect(calls.mask.create).not.toHaveBeenCalled();
  });

  it("keeps directional gradients on the adaptive band pipeline", () => {
    const renderer = new OverlayRenderer(canvas, gl);
    for (const direction of ["top", "bottom"] as const) {
      const profile = { direction, maxRadius: 24, blurCurve: curve };
      const atlas = renderer.createLayout(800, 600, profile, 1);
      expect(atlas.bands.length).toBeGreaterThan(1);
      expect(atlas.bands.at(-1)?.scale).toBe(1);
      renderer.render(profile);
      expect(calls.gradient.render).toHaveBeenLastCalledWith(
        { ...profile, uniformRadius: false },
        undefined,
      );
    }
    expect(calls.mask.create).not.toHaveBeenCalled();
  });

  it("samples the core of a larger uniform neighborhood without stretching it", () => {
    const renderer = new OverlayRenderer(canvas, gl);
    const profile = { maxRadius: 12 };
    const capture = { width: 400, height: 300, offsetX: 40, offsetY: 60 };
    const atlas = renderer.createLayout(200, 150, profile, 2, capture);
    expect(atlas).toMatchObject({ sourceWidth: 400, sourceHeight: 300 });
    const crop = { x: 80, y: 40, width: 400, height: 300 };
    const view = { width: 200, height: 150 };
    renderer.uploadGpuAtlas(source, crop, atlas, profile, view);
    expect(calls.gradient.upload).toHaveBeenLastCalledWith(
      source,
      crop,
      atlas,
      expect.objectContaining({ direction: "top" }),
      view,
      { x: 0.1, y: 0.2, width: 0.5, height: 0.5 },
    );
    const full = renderer.createLayout(400, 300, profile, 2);
    renderer.uploadGpuAtlas(source, crop, full, profile, view);
    expect(calls.gradient.upload.mock.lastCall?.[5]).toBeUndefined();
  });

  it("routes masks through the spatial planner and ignores gradient curves", () => {
    const renderer = new OverlayRenderer(canvas, gl, {
      width: 1,
      height: 1,
      values: new Uint8Array([128]),
    });
    const profile = { maxRadius: 24, blurCurve: curve };
    const planned = { bands: [] };
    calls.mask.layout.mockReturnValueOnce(planned);
    expect(renderer.createLayout(800, 600, profile, 1)).toBe(planned);
    renderer.render(profile);
    expect(calls.mask.layout).toHaveBeenCalledWith(
      800,
      600,
      expect.objectContaining({ maxRadius: 24, blurCurve: undefined }),
      1,
      undefined,
    );
    expect(calls.mask.render).toHaveBeenCalledWith(
      expect.objectContaining({ maxRadius: 24, blurCurve: undefined }),
      { x: 0, y: 0, width: 800, height: 600 },
    );
    expect(calls.gradient.render).not.toHaveBeenCalled();
  });
});
