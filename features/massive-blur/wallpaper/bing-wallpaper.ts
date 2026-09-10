import { FALLBACK_WALLPAPER, type DailyWallpaper } from "./types";

const ARCHIVE =
  "https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=zh-CN";
export const BING_IMAGE_ID = /^OHR\.[A-Za-z0-9_-]{1,160}$/;

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

export function parseBingWallpaper(payload: unknown): DailyWallpaper {
  const images = record(payload).images;
  const first = record(Array.isArray(images) ? images[0] : undefined);
  if (typeof first.urlbase !== "string") throw new Error("Missing Bing image");
  const url = new URL(first.urlbase, "https://www.bing.com");
  const imageId = url.searchParams.get("id") ?? "";
  if (
    url.origin !== "https://www.bing.com" ||
    url.pathname !== "/th" ||
    !BING_IMAGE_ID.test(imageId)
  )
    throw new Error("Invalid Bing image address");
  const date =
    typeof first.enddate === "string" && /^\d{8}$/.test(first.enddate)
      ? first.enddate.replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3")
      : "";
  return {
    src: `/api/bing-wallpaper/image?id=${encodeURIComponent(imageId)}`,
    title: typeof first.title === "string" ? first.title : "必应每日一图",
    credit:
      typeof first.copyright === "string" ? first.copyright : "Bing 每日一图",
    date,
    link: "https://www.bing.com",
    daily: true,
  };
}

export async function getDailyWallpaper(): Promise<DailyWallpaper> {
  try {
    const response = await fetch(ARCHIVE, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`Bing archive: ${response.status}`);
    return parseBingWallpaper(await response.json());
  } catch {
    return FALLBACK_WALLPAPER;
  }
}
