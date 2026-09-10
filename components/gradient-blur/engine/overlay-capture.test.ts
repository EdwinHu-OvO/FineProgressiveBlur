import { describe, expect, it } from "vitest";
import { overlayCapture } from "./overlay-capture";
import { analyzeMask } from "../mask/mask-regions";
import { createMaskAtlasLayout } from "../mask/mask-atlas";

const rect = (x: number, y: number, width: number, height: number) =>
  ({
    x,
    y,
    left: x,
    top: y,
    right: x + width,
    bottom: y + height,
    width,
    height,
  }) as DOMRect;
const bounds = rect(10, 20, 400, 300);
const canvas = {
  width: 800,
  height: 600,
  getBoundingClientRect: () => bounds,
} as HTMLCanvasElement;

describe("non-gradient capture neighborhood", () => {
  it("samples outside partial overlays on both axes, clipped to the source", () => {
    const capture = overlayCapture(
      canvas,
      bounds,
      rect(80, 100, 120, 100),
      { maxRadius: 12 },
      true,
    )!;
    expect(capture.width).toBe(240);
    expect(capture.height).toBe(200);
    expect(capture.sampleRegion).toEqual({
      width: 436,
      height: 396,
      offsetX: 98,
      offsetY: 98,
    });
    const mask = { width: 1, height: 1, values: new Uint8Array([255]) };
    const atlas = createMaskAtlasLayout(
      analyzeMask(mask, 240, 200),
      240,
      200,
      12,
      2,
      8192,
      capture.sampleRegion,
    );
    expect(atlas.maskRegion).toEqual({ x: 98, y: 98, width: 240, height: 200 });
    expect(
      atlas.bands[0].captureStart * atlas.sourceHeight,
    ).toBeLessThanOrEqual(98 - 72);
    expect(
      atlas.bands[0].captureEnd * atlas.sourceHeight,
    ).toBeGreaterThanOrEqual(98 + 200 + 72);
  });

  it("retains top and bottom coordinates without mirroring the mask", () => {
    const top = overlayCapture(
      canvas,
      bounds,
      rect(10, 20, 400, 80),
      { maxRadius: 24 },
      true,
    )!;
    const bottom = overlayCapture(
      canvas,
      bounds,
      rect(10, 240, 400, 80),
      { maxRadius: 24 },
      true,
    )!;
    expect(top.sampleRegion?.offsetY).toBe(0);
    expect(bottom.sampleRegion?.offsetY).toBe(194);
    expect(top.crop.height).toBe(bottom.crop.height);
    expect(bottom.crop.y + bottom.crop.height).toBe(canvas.height);
  });

  it("leaves gradients and zero radius at the output footprint", () => {
    for (const [needsHalo, maxRadius] of [
      [false, 24],
      [true, 0],
    ] as const) {
      const capture = overlayCapture(
        canvas,
        bounds,
        rect(10, 240, 400, 80),
        { direction: "bottom", maxRadius },
        needsHalo,
      )!;
      expect(capture.crop).toEqual({ x: 0, y: 440, width: 800, height: 160 });
    }
    expect(
      overlayCapture(
        canvas,
        bounds,
        rect(500, 0, 50, 50),
        { direction: "top", maxRadius: 24 },
        true,
      ),
    ).toBeNull();
  });
});
