import { useEffect, useState } from "react";
import { sitePath } from "@/lib/site-path";
import { FALLBACK_WALLPAPER, type DailyWallpaper } from "./types";

const WALLPAPER_URL = sitePath(
  process.env.NEXT_PUBLIC_STATIC_EXPORT === "true"
    ? "/wallpaper/bing-wallpaper.json"
    : "/api/bing-wallpaper",
);

export function useDailyWallpaper() {
  const [wallpaper, setWallpaper] = useState(FALLBACK_WALLPAPER);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    fetch(WALLPAPER_URL, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Wallpaper unavailable");
        const next: DailyWallpaper = await response.json();
        // Keep both the native background and GPU capture on the same image.
        const image = new Image();
        image.src = next.src;
        await image.decode();
        if (!controller.signal.aborted) setWallpaper(next);
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);
  return { wallpaper, loading };
}
