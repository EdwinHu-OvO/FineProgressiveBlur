import type { Metadata } from "next";
import { MassiveBlurDashboard } from "@/features/massive-blur/MassiveBlurDashboard";

export const metadata: Metadata = {
  title: "Massive Blur · Fine Progressive Blur",
  description: "必应每日一图、可滚动的玻璃卡片工作区与大面积模糊实时性能演示。",
};

export default function MassiveBlurPage() {
  return <MassiveBlurDashboard />;
}
