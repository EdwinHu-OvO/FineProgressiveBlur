import { describe, expect, it } from "vitest";
import { createMaskAtlasLayout, type MaskAtlasLayout } from "./mask-atlas";
import { analyzeMask } from "./mask-regions";
import { maskBlurLevels } from "./mask-levels";
import type { ResolvedBlurMask } from "./types";

function layout(
  mask: ResolvedBlurMask,
  width = 512,
  height = 384,
  radius = 24,
  ratio = 1,
) {
  return createMaskAtlasLayout(
    analyzeMask(mask, width, height),
    width,
    height,
    radius,
    ratio,
  );
}

function expectCoverage(
  atlas: MaskAtlasLayout,
  sigma: number,
  x: number,
  y: number,
) {
  const upper = atlas.levels.findIndex((radius) => radius >= sigma);
  const lower = sigma === atlas.levels[upper] ? upper : Math.max(0, upper - 1);
  new Set([lower, upper]).forEach((level) => {
    expect(
      atlas.bands.filter(
        (patch) =>
          patch.level === level &&
          x >= patch.core.x &&
          x < patch.core.x + patch.core.width &&
          y >= patch.core.y &&
          y < patch.core.y + patch.core.height,
      ),
    ).toHaveLength(1);
  });
}

describe("mask-driven sparse capture", () => {
  it("keeps all-black masks at native resolution and reduces all-white masks", () => {
    const clear = layout({ width: 1, height: 1, values: new Uint8Array([0]) });
    expect(clear.bands).toHaveLength(1);
    expect(clear.bands[0].scale).toBe(1);
    expect(clear.bands[0].sigma).toBe(0);
    const blurred = layout({
      width: 1,
      height: 1,
      values: new Uint8Array([255]),
    });
    expect(blurred.bands).toHaveLength(1);
    expect(blurred.bands[0].scale).toBe(1 / 8);
    expect(blurred.width * blurred.height).toBeLessThan((512 * 384) / 32);
  });

  it("handles zero/invalid radii and subpixel sigma without dropping content", () => {
    const mask = { width: 1, height: 1, values: new Uint8Array([128]) };
    for (const radius of [0, -12, NaN, Infinity]) {
      const atlas = layout(mask, 101, 77, radius);
      expect(atlas.levels).toEqual([0]);
      expect(atlas.bands).toHaveLength(1);
      expect(atlas.bands[0].scale).toBe(1);
    }
    expect(
      layout(mask, 101, 77, 0.1).bands.every((patch) => patch.scale === 1),
    ).toBe(true);
  });

  it("retains a single clear pixel inside a large blurred field", () => {
    const values = new Uint8Array(512 * 384).fill(255);
    values[191 * 512 + 257] = 0;
    const atlas = layout({ width: 512, height: 384, values });
    expectCoverage(atlas, 0, 257.5, 191.5);
    expectCoverage(atlas, 24, 256.5, 191.5);
    const sharp = atlas.bands.filter((patch) => patch.sigma === 0);
    expect(
      sharp.reduce((area, patch) => area + patch.width * patch.height, 0),
    ).toBeLessThan((512 * 384) / 8);
    expect(
      new Set(atlas.bands.map((patch) => patch.scale)).size,
    ).toBeGreaterThan(1);
  });

  it("covers interpolated strengths at every cell boundary and odd DPR dimensions", () => {
    const width = 17,
      height = 11;
    const values = Uint8Array.from(
      { length: width * height },
      (_, index) => (index * 137) % 256,
    );
    const atlas = layout({ width, height, values }, 513, 387, 28, 2);
    for (let y = 0.5; y < 387; y += 7)
      for (let x = 0.5; x < 513; x += 7) {
        const mx = Math.max(0, Math.min(width - 1, (x / 513) * width - 0.5));
        const my = Math.max(0, Math.min(height - 1, (y / 387) * height - 0.5));
        const left = Math.floor(mx),
          top = Math.floor(my);
        const right = Math.min(width - 1, left + 1),
          bottom = Math.min(height - 1, top + 1);
        const a =
          values[top * width + left] * (1 - (mx % 1)) +
          values[top * width + right] * (mx % 1);
        const b =
          values[bottom * width + left] * (1 - (mx % 1)) +
          values[bottom * width + right] * (mx % 1);
        expectCoverage(
          atlas,
          ((a * (1 - (my % 1)) + b * (my % 1)) / 255) * 28,
          x,
          y,
        );
      }
  });

  it("aligns every rectangular crop to real pyramid texels with a convolution halo", () => {
    const values = new Uint8Array(128 * 96).fill(255);
    values.fill(0, 0, 128 * 20);
    const atlas = layout({ width: 128, height: 96, values }, 513, 387, 12, 2);
    for (const patch of atlas.bands) {
      const w = Math.ceil(513 * patch.scale),
        h = Math.ceil(387 * patch.scale);
      expect((patch.captureRight - patch.captureLeft) * w).toBeCloseTo(
        patch.width,
        8,
      );
      expect((patch.captureEnd - patch.captureStart) * h).toBeCloseTo(
        patch.height,
        8,
      );
      expect(patch.captureLeft * 513).toBeLessThanOrEqual(
        Math.max(0, patch.core.x - 3 * patch.sigma * 2),
      );
      expect(patch.captureEnd * 387 + 1e-8).toBeGreaterThanOrEqual(
        Math.min(387, patch.core.y + patch.core.height + 3 * patch.sigma * 2),
      );
      expect(patch.x + patch.width).toBeLessThan(atlas.width);
      expect(patch.y + patch.height).toBeLessThan(atlas.height);
    }
  });

  it("bounds fragmented masks without throwing away their required levels", () => {
    const mask = {
      width: 32,
      height: 32,
      values: Uint8Array.from(
        { length: 1024 },
        (_, i) => ((i + Math.floor(i / 32)) % 2) * 255,
      ),
    };
    const atlas = layout(mask, 1024, 1024, 24);
    expect(atlas.bands.length).toBeLessThanOrEqual(atlas.levels.length * 24);
    expect(() =>
      createMaskAtlasLayout(
        analyzeMask(mask, 1024, 1024),
        1024,
        1024,
        24,
        1,
        64,
      ),
    ).toThrow("GPU");
  });
});

describe("scale-space levels", () => {
  it("includes a sharp level, a subpixel level and an exact maximum", () => {
    const levels = maskBlurLevels(28, 2);
    expect(levels[0]).toBe(0);
    expect(levels[1]).toBe(0.25);
    expect(levels.at(-1)).toBe(28);
    for (let index = 2; index < levels.length; index++) {
      expect(levels[index]).toBeGreaterThan(levels[index - 1]);
      expect(levels[index] / levels[index - 1]).toBeLessThanOrEqual(
        Math.SQRT2 + 1e-12,
      );
    }
  });
});
