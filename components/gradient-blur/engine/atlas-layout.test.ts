import { describe, expect, it } from "vitest";
import {
  ATLAS_GUTTER,
  createAtlasLayout,
  createUniformAtlasLayout,
  MAX_TEXEL_SIGMA,
} from "./atlas-layout";
import { blurRadiusAt } from "./profile";

describe("radius-adaptive atlas", () => {
  it("keeps the entire strip at full resolution for zero or small blur", () => {
    for (const radius of [0, 1, 2, 4]) {
      const layout = createAtlasLayout(1000, 200, radius, 1);
      expect(layout.bands).toHaveLength(1);
      expect(layout.bands[0]).toMatchObject({
        scale: 1,
        width: 1000,
        height: 200,
        captureStart: 0,
        captureEnd: 1,
      });
      expect(layout.height).toBe(200 + ATLAS_GUTTER * 2);
    }
  });

  it("moves the boundaries with radius and DPR, rather than fixed percentages", () => {
    const small = createAtlasLayout(1000, 200, 8, 1);
    const large = createAtlasLayout(1000, 200, 28, 1);
    const retina = createAtlasLayout(2000, 400, 28, 2);
    expect(small.bands.map((b) => b.scale)).toEqual([0.5, 1]);
    expect(large.bands.map((b) => b.scale)).toEqual([0.125, 0.25, 0.5, 1]);
    expect(retina.bands[0].scale).toBeLessThan(large.bands[0].scale);
    expect(retina.bands.find((b) => b.scale === 0.25)!.coreEnd).toBeGreaterThan(
      large.bands.find((b) => b.scale === 0.25)!.coreEnd,
    );
    expect(large.bands.find((b) => b.scale === 1)!.coreStart).toBeGreaterThan(
      small.bands[1].coreStart,
    );
    for (const band of retina.bands) {
      if (band.scale === 1) continue;
      expect(blurRadiusAt(band.coreEnd, 28) * 2).toBeGreaterThanOrEqual(
        2 / band.scale,
      );
    }
  });

  it("covers the source continuously, with aligned overlapping crops and no shelf overlap", () => {
    const layout = createAtlasLayout(1000, 200, 28, 2);
    const outer = layout.bands[0],
      inner = layout.bands.at(-1)!;
    expect(outer.coreStart).toBe(0);
    expect(inner.coreEnd).toBe(1);
    for (let index = 0; index < layout.bands.length - 1; index++) {
      const current = layout.bands[index],
        next = layout.bands[index + 1];
      expect(current.coreEnd).toBe(next.coreStart);
      expect(current.captureEnd).toBeGreaterThan(next.coreStart);
      expect(next.captureStart).toBeLessThan(current.coreEnd);
      if (next !== inner) {
        expect(current.y).toBe(next.y);
        expect(next.x).toBe(current.x + current.width + ATLAS_GUTTER * 2);
      }
    }
    expect(outer.y).toBeGreaterThan(inner.y + inner.height);
    expect(layout.width * layout.height).toBeLessThan(1000 * 200 * 0.8);
  });

  it("retains the Gaussian support on both sides of each core", () => {
    const layout = createAtlasLayout(1200, 600, 48, 2);
    for (const band of layout.bands) {
      const halo = 3 * blurRadiusAt(band.coreStart, 48) * 2;
      expect(band.captureStart * 600).toBeLessThanOrEqual(
        Math.max(0, band.coreStart * 600 - halo),
      );
      expect(band.captureEnd * 600).toBeGreaterThanOrEqual(
        Math.min(600, band.blendEnd * 600 + halo),
      );
    }
  });

  it("bounds uniform convolution cost at large CSS sigma, and restores all pixels at zero", () => {
    for (const dpr of [1, 1.5, 2])
      for (const sigma of [0, 1, 4, 8, 24, 48]) {
        const layout = createUniformAtlasLayout(
          1000 * dpr,
          600 * dpr,
          sigma,
          dpr,
        );
        expect(layout.bands).toHaveLength(1);
        const band = layout.bands[0];
        expect(sigma * dpr * band.scale).toBeLessThanOrEqual(MAX_TEXEL_SIGMA);
        expect(band.captureStart).toBe(0);
        expect(band.captureEnd).toBe(1);
        if (sigma === 0) expect(band.scale).toBe(1);
      }
  });

  it("keeps tiny sources valid even at large blur radii", () => {
    const layout = createAtlasLayout(1, 1, 100, 2);
    expect(layout.bands).toHaveLength(1);
    expect(layout.bands[0]).toMatchObject({ width: 1, height: 1, scale: 1 });
  });

  it("copies every band without stretching, even with odd pyramid dimensions or bottom blur", () => {
    for (const height of [80, 111, 113, 176, 225, 351]) {
      for (const radius of [8, 16, 28, 48]) {
        for (const band of createAtlasLayout(719, height, radius, 2).bands) {
          const levelHeight = Math.ceil(height * band.scale);
          for (const [start, end] of [
            [band.captureStart, band.captureEnd],
            [1 - band.captureEnd, 1 - band.captureStart],
          ]) {
            expect(start * levelHeight).toBeCloseTo(
              Math.round(start * levelHeight),
            );
            expect(end * levelHeight).toBeCloseTo(
              Math.round(end * levelHeight),
            );
            expect(band.height).toBe(
              Math.round(end * levelHeight) - Math.round(start * levelHeight),
            );
          }
        }
      }
    }
  });

  it("blends consecutive levels within their Gaussian support without triple overlaps", () => {
    for (const dpr of [1, 1.5, 2])
      for (const radius of [8, 28, 48]) {
        const { bands } = createAtlasLayout(1000 * dpr, 200 * dpr, radius, dpr);
        for (let index = 0; index < bands.length - 1; index++) {
          const current = bands[index],
            next = bands[index + 1];
          expect(current.blendEnd).toBeGreaterThan(current.coreEnd);
          expect(current.blendEnd).toBeLessThan(next.coreEnd);
          expect(current.captureEnd).toBeGreaterThanOrEqual(current.blendEnd);
          expect(next.captureStart).toBeLessThanOrEqual(current.coreEnd);
          expect(
            blurRadiusAt(current.coreEnd, radius) * dpr * next.scale,
          ).toBeCloseTo(MAX_TEXEL_SIGMA);
          expect(
            blurRadiusAt(current.blendEnd, radius) * dpr * next.scale,
          ).toBeCloseTo(3);
        }
      }
  });
});
