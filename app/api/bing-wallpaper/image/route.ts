import { BING_IMAGE_ID } from "@/features/massive-blur/wallpaper/bing-wallpaper";

/** Same-origin images can be sampled by both Canvas capture backends. */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!BING_IMAGE_ID.test(id))
    return new Response("Invalid image id", { status: 400 });
  try {
    const response = await fetch(
      `https://www.bing.com/th?id=${encodeURIComponent(id)}_1920x1080.jpg`,
      {
        next: { revalidate: 86400 },
        signal: AbortSignal.timeout(10000),
      },
    );
    const type = response.headers.get("content-type") ?? "";
    if (!response.ok || !/^image\/(jpeg|png|webp)/.test(type))
      throw new Error("Bing image unavailable");
    const pixels = await response.arrayBuffer();
    if (pixels.byteLength > 12 * 1024 * 1024)
      throw new Error("Bing image too large");
    return new Response(pixels, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch {
    return new Response("Wallpaper temporarily unavailable", { status: 502 });
  }
}
