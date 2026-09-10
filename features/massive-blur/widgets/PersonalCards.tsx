import { useState } from "react";
import { GlassCard } from "../GlassCard";
import { Icon } from "../Icon";
import type { DailyWallpaper } from "../wallpaper/types";
import styles from "./personal.module.css";
import base from "./widgets.module.css";

export function WallpaperCard({
  wallpaper,
  loading,
}: {
  wallpaper: DailyWallpaper;
  loading: boolean;
}) {
  return (
    <GlassCard id="daily-image">
      <div className={base.cardHeading}>
        <h2>窗外的世界</h2>
        <Icon name="arrow" />
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={styles.wallpaperThumbnail}
        src={wallpaper.src}
        alt={wallpaper.title}
      />
      <h3 className={styles.wallpaperTitle}>
        {loading ? "正在获取今日影像…" : wallpaper.title}
      </h3>
      <a
        className={styles.wallpaperCredit}
        href={wallpaper.link}
        target="_blank"
        rel="noreferrer"
      >
        {wallpaper.credit}
      </a>
    </GlassCard>
  );
}

export function NotesCard() {
  const [note, setNote] = useState(
    "留白也是设计的一部分。\n\n让背景保持流动，让信息安静地浮在上面。\n\n下一步：在不同屏幕上观察滚动时的质感。",
  );
  return (
    <GlassCard id="notes" span={5}>
      <div className={base.cardHeading}>
        <h2>随手记</h2>
        <span>01</span>
      </div>
      <textarea
        className={styles.note}
        aria-label="随手记"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        spellCheck={false}
      />
      <p className={base.cardFootnote}>可编辑 · 仅保留在当前页面</p>
    </GlassCard>
  );
}

const ACTIVITY = [
  ["刚刚", "打开了一个新的工作空间", "从今天的必应影像开始。"],
  ["10:42", "设计参考已归档", "12 个片段，组成下一轮探索。"],
  ["09:35", "完成了一次设计同步", "把复杂的部分留在实现里。"],
  ["昨天", "更新了组件实验", "默认全模糊、方向渐变与蒙版。"],
];
export function RecentActivity() {
  return (
    <GlassCard id="activity" span={7}>
      <div className={base.cardHeading}>
        <h2>最近动态</h2>
        <span>工作区记录 · 示例</span>
      </div>
      <div className={styles.activity}>
        {ACTIVITY.map(([time, title, detail]) => (
          <div key={time}>
            <span className={styles.activityDot} />
            <div>
              <strong>{title}</strong>
              <p>{detail}</p>
            </div>
            <time>{time}</time>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
