import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getBingImage } from "../features/massive-blur/wallpaper/bing-image.ts";
import { getDailyWallpaper } from "../features/massive-blur/wallpaper/bing-wallpaper.ts";
import { FALLBACK_WALLPAPER } from "../features/massive-blur/wallpaper/types.ts";
import { sitePath } from "../lib/site-path.ts";

/** Download a matched metadata/image pair so static hosts need no image proxy. */
export async function exportWallpaper(directory: string) {
  await mkdir(directory, { recursive: true });
  let wallpaper = await getDailyWallpaper();
  if (wallpaper.daily) {
    try {
      const id =
        new URL(wallpaper.src, "https://localhost").searchParams.get("id") ??
        "";
      const { pixels, type } = await getBingImage(id);
      const filename = `${id}.${type.split("/")[1]}`;
      await writeFile(join(directory, filename), Buffer.from(pixels));
      wallpaper = { ...wallpaper, src: sitePath(`/wallpaper/${filename}`) };
    } catch {
      wallpaper = FALLBACK_WALLPAPER;
    }
  }
  await writeFile(
    join(directory, "bing-wallpaper.json"),
    `${JSON.stringify(wallpaper)}\n`,
  );
  if (!wallpaper.daily)
    console.warn("Bing wallpaper unavailable; exporting the local demo image.");
}
