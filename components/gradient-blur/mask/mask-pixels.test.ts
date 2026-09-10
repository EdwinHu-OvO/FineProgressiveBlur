import { describe, expect, it } from "vitest";
import { resolveMaskPixels } from "./mask-pixels";

const pixels = {
  width: 5,
  height: 1,
  data: new Uint8ClampedArray([
    0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 0, 255, 255, 255, 128, 255,
    0, 0, 255,
  ]),
};

describe("mask strength decoding", () => {
  it("uses luminance times alpha without conflating black and transparency", () => {
    expect([...resolveMaskPixels(pixels, {}).values]).toEqual([
      0, 255, 0, 128, 54,
    ]);
  });
  it("supports alpha masks and inversion after decoding", () => {
    expect([...resolveMaskPixels(pixels, { channel: "alpha" }).values]).toEqual(
      [255, 255, 0, 128, 255],
    );
    expect([...resolveMaskPixels(pixels, { invert: true }).values]).toEqual([
      255, 0, 255, 127, 201,
    ]);
  });
  it("rejects malformed pixel buffers", () => {
    expect(() => resolveMaskPixels({ ...pixels, width: 6 }, {})).toThrow(
      "Invalid blur mask",
    );
  });
});
