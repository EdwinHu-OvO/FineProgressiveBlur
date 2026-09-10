import { BING_IMAGE_ID } from "@/features/massive-blur/wallpaper/bing-wallpaper";
import { getBingImage } from "@/features/massive-blur/wallpaper/bing-image";

/** Same-origin images can be sampled by both Canvas capture backends. */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!BING_IMAGE_ID.test(id))
    return new Response("Invalid image id", { status: 400 });
  try {
    const { pixels, type } = await getBingImage(id);
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
