"use client";

import { useState } from "react";
import FineProgressiveBlur from "@/component/FineProgressiveBlur";
import Image from "next/image";

export default function Home() {
  const [blur, setBlur] = useState(5);
  const [height, setHeight] = useState(70);
  const [color, setColor] = useState("rgba(255,255,255,0.85)");
  const [position, setPosition] = useState<"top" | "bottom" | "both">("both");
  const [mode, setMode] = useState<"text" | "image">("text");

  const presets = [
    {
      label: "白 高斯/两端",
      blur: 24,
      height: 120,
      color: "rgba(255,255,255,0.85)",
      position: "both" as const,
    },
    {
      label: "透明 顶部",
      blur: 32,
      height: 140,
      color: "#ffffff00",
      position: "top" as const,
    },
    {
      label: "浅色 底部",
      blur: 16,
      height: 100,
      color: "rgba(255,255,255,0.15)",
      position: "bottom" as const,
    },
  ];

  const colorSwatches = [
    "rgba(255,255,255,0.85)",
    "rgba(0,0,0,0.35)",
    "#ffffff00",
    "#ff6b6bb3",
    "#4f46e5cc",
  ];

  return (
    <div className="min-h-dvh w-full flex flex-col items-center py-10 gap-10">
      <div className="max-w-5xl w-full px-6">
        <h1 className="text-2xl font-semibold">FineProgressiveBlur 演示</h1>
        <p className="text-sm opacity-70 mt-1">
          通过细腻 + 递增分层的方式，使顶部/底部的背景高斯模糊更加自然、平滑。
        </p>
      </div>

      {/* 控制面板 */}
      <div className="max-w-5xl w-full px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 rounded-xl border border-black/10 p-4">
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="ctrl-blur" className="text-sm font-medium">
                  模糊强度 blur
                </label>
                <span className="text-sm tabular-nums">{blur}px</span>
              </div>
              <input
                type="range"
                min={0}
                max={60}
                value={blur}
                onChange={(e) => setBlur(Number(e.target.value))}
                id="ctrl-blur"
                className="w-full"
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="ctrl-height" className="text-sm font-medium">
                  渐隐高度 height
                </label>
                <span className="text-sm tabular-nums">{height}px</span>
              </div>
              <input
                type="range"
                min={0}
                max={240}
                value={height}
                onChange={(e) => setHeight(Number(e.target.value))}
                id="ctrl-height"
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">颜色 color</label>
              <div className="flex items-center gap-2 flex-wrap">
                {colorSwatches.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    title={c}
                    className={`h-7 px-2 rounded-md border text-xs ${
                      color === c ? "ring-2 ring-indigo-500" : ""
                    }`}
                    style={{ background: c }}
                  >
                    &nbsp;
                  </button>
                ))}
                <input
                  className="h-8 px-2 text-sm rounded-md border min-w-0 grow"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="rgba(...)/#RRGGBB[AA]"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">位置 position</label>
              <div className="flex gap-3">
                {["top", "bottom", "both"].map((p) => (
                  <label key={p} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="position"
                      value={p}
                      checked={position === p}
                      onChange={() =>
                        setPosition(p as "top" | "bottom" | "both")
                      }
                    />
                    {p}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">内容类型</label>
              <div className="flex gap-3">
                {[
                  { k: "text", n: "文本" },
                  { k: "image", n: "图片" },
                ].map((o) => (
                  <label key={o.k} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="mode"
                      value={o.k}
                      checked={mode === (o.k as "text" | "image")}
                      onChange={() => setMode(o.k as "text" | "image")}
                    />
                    {o.n}
                  </label>
                ))}
              </div>
            </div>

            <div className="text-xs opacity-70">
              支持颜色格式：rgba(...)、#RRGGBB、#RRGGBBAA。
            </div>
          </div>
        </div>
      </div>

      {/* 预览区 */}
      <div className="max-w-5xl w-full px-6">
        <div className="rounded-xl border border-black/10 p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-50 to-zinc-100">
          <FineProgressiveBlur
            blur={blur}
            height={height}
            color={color}
            position={position}
            border={8}
          >
            {mode === "text" ? (
              <div className="w-full max-w-3xl h-[320px] overflow-auto bg-white/60 backdrop-blur-sm rounded-lg p-6 shadow-sm">
                <h2 className="font-medium mb-3">示例文本内容</h2>
                {Array.from({ length: 30 }).map((_, i) => (
                  <p key={i} className="text-sm leading-6 text-black/70">
                    这是一段用于观察渐进式模糊效果的示例文本。第 {i + 1} 行。
                  </p>
                ))}
              </div>
            ) : (
              <div className="w-full max-w-3xl">
                <Image
                  src="/sample.jpg"
                  alt="Sample"
                  width={960}
                  height={640}
                  className="rounded-lg shadow-sm"
                />
              </div>
            )}
          </FineProgressiveBlur>
        </div>
      </div>
    </div>
  );
}
