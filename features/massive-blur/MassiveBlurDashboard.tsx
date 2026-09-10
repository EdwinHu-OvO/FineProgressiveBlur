"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import type {
  GradientBlurActiveBackend,
  GradientBlurBackend,
} from "@/components/gradient-blur";
import { GlassBackdrop } from "./surface/GlassBackdrop";
import { PerformancePanel } from "./performance/PerformancePanel";
import { useMassiveMetrics } from "./performance/useMassiveMetrics";
import { useDailyWallpaper } from "./wallpaper/useDailyWallpaper";
import { ActivityOverview } from "./widgets/ActivityOverview";
import { FocusTimer } from "./widgets/FocusTimer";
import { WorkspacePanels } from "./widgets/WorkspacePanels";
import { ProjectTable } from "./widgets/ProjectTable";
import {
  NotesCard,
  RecentActivity,
  WallpaperCard,
} from "./widgets/PersonalCards";
import { Icon } from "./Icon";
import styles from "./dashboard.module.css";

export function MassiveBlurDashboard() {
  const root = useRef<HTMLElement>(null);
  const [radius, setRadius] = useState(48);
  const [enabled, setEnabled] = useState(true);
  const [backend, setBackend] = useState<GradientBlurBackend>("auto");
  const [activeBackend, setActiveBackend] =
    useState<GradientBlurActiveBackend>("css");
  const [pixelRatio, setPixelRatio] = useState(2);
  const { wallpaper, loading } = useDailyWallpaper();
  const { summary, onMetrics, onRegions, resetMetrics } = useMassiveMetrics();
  const reportBackend = useCallback(
    (next: GradientBlurActiveBackend) => {
      setActiveBackend(next);
      resetMetrics();
    },
    [resetMetrics],
  );

  return (
    <div
      className={styles.page}
      data-massive-blur=""
      data-blur-enabled={enabled}
    >
      <div className={styles.background} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={wallpaper.src} alt="" fetchPriority="high" />
      </div>
      <GlassBackdrop
        root={root}
        src={wallpaper.src}
        radius={enabled ? radius : 0}
        backend={backend}
        pixelRatio={pixelRatio}
        onBackend={reportBackend}
        onMetrics={onMetrics}
        onRegions={onRegions}
      />
      <div className={styles.shell}>
        <header className={styles.topbar}>
          <Link href="/" className={styles.brand}>
            <span className={styles.brandMark}>
              <Icon name="grid" size={17} />
            </span>
            Fine<span className={styles.brandDivider}>/</span>
            <span>Massive Blur</span>
          </Link>
          <nav aria-label="演示导航">
            <a href="#performance">性能实况</a>
            <Link href="/benchmark">
              GPU 基准 <Icon name="arrow" size={13} />
            </Link>
          </nav>
          <span className={styles.avatar} aria-label="演示工作区">
            F
          </span>
        </header>
        <main ref={root}>
          <div className={styles.welcome}>
            <div>
              <p className={styles.eyebrow}>WORKSPACE / MASSIVE BLUR</p>
              <h1>
                工作概览<span>。</span>
              </h1>
              <p className={styles.intro}>
                必应每日影像，玻璃卡片工作区。
                <span>Dashboard demo · 示例数据</span>
              </p>
            </div>
            <div className={styles.today}>
              <span>
                {wallpaper.date
                  ? wallpaper.date.replaceAll("-", " / ")
                  : "DAILY WORKSPACE"}
              </span>
              <strong>
                {loading
                  ? "正在连接必应…"
                  : wallpaper.daily
                    ? "每日一图，今日背景"
                    : "本地背景 · 离线预览"}
              </strong>
            </div>
          </div>
          <div className={styles.grid}>
            <PerformancePanel
              radius={radius}
              enabled={enabled}
              backend={backend}
              activeBackend={activeBackend}
              pixelRatio={pixelRatio}
              metrics={summary}
              onRadius={setRadius}
              onEnabled={setEnabled}
              onBackend={setBackend}
              onPixelRatio={setPixelRatio}
            />
            <ActivityOverview />
            <FocusTimer />
            <WorkspacePanels />
            <ProjectTable />
            <WallpaperCard wallpaper={wallpaper} loading={loading} />
            <NotesCard />
            <RecentActivity />
          </div>
        </main>
        <footer className={styles.footer}>
          <span>
            FINE PROGRESSIVE BLUR<span>原生滚动 · 共享背景纹理</span>
          </span>
          <a href={wallpaper.link} target="_blank" rel="noreferrer">
            {loading ? "Bing 每日一图" : wallpaper.credit}{" "}
            <Icon name="arrow" size={12} />
          </a>
        </footer>
      </div>
    </div>
  );
}
