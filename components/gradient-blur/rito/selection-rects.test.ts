import { describe, expect, it } from "vitest";
import { mergeLineRects } from "./vendor/selection-rects";

describe("Rito selection geometry", () => {
  it("joins adjacent fragments without filling the gap between columns", () => {
    const rects = [
      { x: 0, y: 0, width: 10, height: 20 },
      { x: 10, y: 0, width: 30, height: 20 },
      { x: 80, y: 0, width: 20, height: 20 },
    ];
    expect(mergeLineRects(rects)).toEqual([
      { x: 0, y: 0, width: 40, height: 20 },
      rects[2],
    ]);
  });
  it("keeps lines with different font envelopes separate", () => {
    const rects = [
      { x: 0, y: 0, width: 10, height: 20 },
      { x: 10, y: 0, width: 10, height: 30 },
    ];
    expect(mergeLineRects(rects)).toEqual(rects);
  });
});
