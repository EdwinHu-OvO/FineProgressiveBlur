import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const archive = {
  images: [
    {
      urlbase: "/th?id=OHR.Example_ZH-CN123",
      title: "Example landscape",
      copyright: "Example photographer",
      enddate: "20260910",
    },
  ],
};
const pixels = new Uint8Array([255, 216, 255, 217]);
let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "blur-wallpaper-"));
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/FineProgressiveBlur");
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await rm(directory, { recursive: true, force: true });
});

async function exportAndRead() {
  const { exportWallpaper } = await import("./export-wallpaper");
  await exportWallpaper(directory);
  return JSON.parse(
    await readFile(join(directory, "bing-wallpaper.json"), "utf8"),
  );
}

describe("Pages wallpaper snapshot", () => {
  it("exports matching local pixels, attribution, and a repository-prefixed URL", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json(archive))
      .mockResolvedValueOnce(
        new Response(pixels, {
          headers: { "Content-Type": "image/jpeg" },
        }),
      );
    vi.stubGlobal("fetch", fetch);

    expect(await exportAndRead()).toMatchObject({
      src: "/FineProgressiveBlur/wallpaper/OHR.Example_ZH-CN123.jpeg",
      title: "Example landscape",
      credit: "Example photographer",
      date: "2026-09-10",
      daily: true,
    });
    expect(
      await readFile(join(directory, "OHR.Example_ZH-CN123.jpeg")),
    ).toEqual(Buffer.from(pixels));
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "https://www.bing.com/th?id=OHR.Example_ZH-CN123_1920x1080.jpg",
      expect.any(Object),
    );
  });

  it.each(["archive", "image", "content-type"])(
    "exports the local fallback when %s retrieval fails",
    async (failure) => {
      const fetch = vi.fn();
      if (failure === "archive") fetch.mockRejectedValue(new Error("Offline"));
      else {
        fetch.mockResolvedValueOnce(Response.json(archive));
        if (failure === "image")
          fetch.mockRejectedValueOnce(new Error("Offline"));
        else
          fetch.mockResolvedValueOnce(
            new Response("<html>Error</html>", {
              headers: { "Content-Type": "text/html" },
            }),
          );
      }
      vi.stubGlobal("fetch", fetch);

      expect(await exportAndRead()).toMatchObject({
        src: "/FineProgressiveBlur/images/blur-comparison.jpg",
        link: "/FineProgressiveBlur/images/ATTRIBUTION.md",
        date: "",
        daily: false,
      });
    },
  );

  it("supports a root-domain deployment", async () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Offline")));
    expect(await exportAndRead()).toMatchObject({
      src: "/images/blur-comparison.jpg",
      link: "/images/ATTRIBUTION.md",
    });
  });
});
