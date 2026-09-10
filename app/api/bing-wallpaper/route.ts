import { getDailyWallpaper } from "@/features/massive-blur/wallpaper/bing-wallpaper";

export async function GET() {
  const wallpaper = await getDailyWallpaper();
  return Response.json(wallpaper, {
    headers: {
      "Cache-Control": wallpaper.daily ? "public, max-age=300" : "no-store",
    },
  });
}
