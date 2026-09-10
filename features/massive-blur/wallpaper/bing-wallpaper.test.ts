import { describe, expect, it } from "vitest";
import { BING_IMAGE_ID, parseBingWallpaper } from "./bing-wallpaper";

describe("Bing wallpaper boundary", () => {
  it("creates a same-origin image address and retains image attribution", () => {
    const wallpaper = parseBingWallpaper({
      images: [
        {
          urlbase: "/th?id=OHR.Olvera_ZH-CN2727093856",
          title: "俯瞰大地拼图",
          copyright: "Example photographer",
          enddate: "20260910",
        },
      ],
    });
    expect(wallpaper).toMatchObject({
      src: "/api/bing-wallpaper/image?id=OHR.Olvera_ZH-CN2727093856",
      title: "俯瞰大地拼图",
      credit: "Example photographer",
      date: "2026-09-10",
      daily: true,
    });
  });

  it("rejects empty or malformed archive responses", () => {
    for (const payload of [
      null,
      {},
      { images: [] },
      { images: [{ urlbase: 4 }] },
    ])
      expect(() => parseBingWallpaper(payload)).toThrow("Missing Bing image");
  });

  it("does not turn image retrieval into an arbitrary URL proxy", () => {
    for (const urlbase of [
      "https://example.com/th?id=OHR.Test",
      "//example.com/th?id=OHR.Test",
      "/other?id=OHR.Test",
      "/th?id=../../private",
      "/th?id=OHR.Test%26other%3Dvalue",
    ])
      expect(() => parseBingWallpaper({ images: [{ urlbase }] })).toThrow(
        "Invalid Bing image address",
      );
    for (const id of [
      "../image",
      "https://example.com/a",
      "OHR.a?x=1",
      "OHR." + "a".repeat(161),
    ])
      expect(BING_IMAGE_ID.test(id)).toBe(false);
  });
});
