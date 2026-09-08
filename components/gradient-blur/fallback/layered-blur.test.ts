import { describe, expect, it } from "vitest";
import { createBlurLayers, layerMask } from "./layered-blur";

describe("layered CSS blur", () => {
  it("uses eight exponential radii ending at the requested maximum", () => {
    expect(createBlurLayers(32).map((layer) => layer.radius)).toEqual([
      0.25, 0.5, 1, 2, 4, 8, 16, 32,
    ]);
  });

  it("overlaps masks without gaps, keeping the outer edge fully blurred", () => {
    const layers = createBlurLayers(28);
    for (let index = 1; index < layers.length; index++) {
      expect(layers[index].start).toBeLessThan(layers[index - 1].end);
      expect(layers[index].fullStart).toBeLessThanOrEqual(
        layers[index - 1].fullEnd,
      );
    }
    expect(layers[0].start).toBe(0);
    expect(layers.at(-1)).toMatchObject({
      fullStart: 1,
      fullEnd: 1,
      fadeOut: false,
    });
    expect(layers.at(-2)?.fadeOut).toBe(false);
  });

  it("mirrors the clear-to-blurred progression for top and bottom edges", () => {
    const layer = createBlurLayers(32)[0];
    expect(layerMask(layer, "top")).toBe(
      "linear-gradient(to top, transparent 0%, black 12.5%, black 25%, transparent 37.5%)",
    );
    expect(layerMask(layer, "bottom")).toBe(
      "linear-gradient(to bottom, transparent 0%, black 12.5%, black 25%, transparent 37.5%)",
    );
  });

  it.each([0, -1, NaN, Infinity])("omits the stack for radius %s", (radius) => {
    expect(createBlurLayers(radius)).toEqual([]);
  });
});
