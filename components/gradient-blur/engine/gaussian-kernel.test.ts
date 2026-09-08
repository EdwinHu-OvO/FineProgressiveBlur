import { describe, expect, it } from "vitest";
import { createGaussianKernel } from "./gaussian-kernel";

describe("CSS Gaussian bilinear kernel", () => {
  it("preserves constant colors with nonnegative normalized weights", () => {
    for (const sigma of [0, 0.1, 0.5, 1, 2, 3, 4]) {
      const { weights, pairs } = createGaussianKernel(sigma);
      const mass =
        weights[0] +
        2 *
          weights.slice(1, pairs + 1).reduce((sum, weight) => sum + weight, 0);
      expect(mass).toBeCloseTo(1, 6);
      expect(weights.every((value) => value >= 0)).toBe(true);
    }
    expect(createGaussianKernel(0).pairs).toBe(0);
  });

  it("keeps Gaussian variance after reconstructing the bilinear pairs", () => {
    for (const sigma of [1, 2, 3, 4]) {
      const { weights, offsets, pairs } = createGaussianKernel(sigma);
      let variance = 0;
      for (let pair = 0; pair < pairs; pair++) {
        const lower = Math.floor(offsets[pair]),
          fraction = offsets[pair] - lower;
        variance +=
          2 *
          weights[pair + 1] *
          ((1 - fraction) * lower * lower + fraction * (lower + 1) ** 2);
      }
      expect(Math.abs(Math.sqrt(variance) / sigma - 1)).toBeLessThan(0.012);
    }
  });
});
