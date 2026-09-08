import { describe, expect, it } from "vitest";
import { blurProfile, blurRadiusAt } from "./profile";

describe("continuous blur profile", () => {
  it("starts at maximum radius and reaches exactly zero at the content seam", () => {
    expect(blurRadiusAt(0, 24)).toBe(24);
    expect(blurRadiusAt(1, 24)).toBe(0);
    expect(blurRadiusAt(2, 24)).toBe(0);
  });

  it("is monotonic across the whole overlay", () => {
    const samples = Array.from({ length: 101 }, (_, index) =>
      blurProfile(index / 100),
    );
    for (let index = 1; index < samples.length; index += 1) {
      expect(samples[index]).toBeLessThanOrEqual(samples[index - 1]);
    }
  });

  it("has a flat derivative at both edges", () => {
    const epsilon = 0.0001;
    expect(Math.abs(blurProfile(epsilon) - blurProfile(0))).toBeLessThan(1e-9);
    expect(Math.abs(blurProfile(1) - blurProfile(1 - epsilon))).toBeLessThan(
      1e-9,
    );
  });
});
