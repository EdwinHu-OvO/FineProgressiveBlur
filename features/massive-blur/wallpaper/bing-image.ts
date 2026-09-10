import { BING_IMAGE_ID } from "./bing-wallpaper.ts";

export async function getBingImage(id: string) {
  if (!BING_IMAGE_ID.test(id)) throw new Error("Invalid image id");
  const response = await fetch(
    `https://www.bing.com/th?id=${encodeURIComponent(id)}_1920x1080.jpg`,
    {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(10000),
    },
  );
  const type = response.headers.get("content-type")?.split(";")[0].trim() ?? "";
  if (!response.ok || !/^image\/(jpeg|png|webp)$/.test(type))
    throw new Error("Bing image unavailable");
  const pixels = await response.arrayBuffer();
  if (pixels.byteLength > 12 * 1024 * 1024)
    throw new Error("Bing image too large");
  return { pixels, type };
}
