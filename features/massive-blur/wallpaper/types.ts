export interface DailyWallpaper {
  src: string;
  title: string;
  credit: string;
  date: string;
  link: string;
  daily: boolean;
}

export const FALLBACK_WALLPAPER: DailyWallpaper = {
  src: "/images/blur-comparison.jpg",
  title: "山间片刻",
  credit: "必应暂时不可用，正在显示本地演示图片",
  date: "",
  link: "/images/ATTRIBUTION.md",
  daily: false,
};
