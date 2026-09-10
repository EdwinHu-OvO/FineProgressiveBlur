import type {
  GradientBlurActiveBackend,
  GradientBlurBackend,
} from "@/components/gradient-blur";
import { GlassCard } from "../GlassCard";
import { Icon } from "../Icon";
import type { MassiveMetrics } from "./useMassiveMetrics";
import { useScrollPerformance } from "./useScrollPerformance";
import styles from "./performance.module.css";

interface PerformancePanelProps {
  radius: number;
  enabled: boolean;
  backend: GradientBlurBackend;
  activeBackend: GradientBlurActiveBackend;
  pixelRatio: number;
  metrics: MassiveMetrics;
  onRadius(radius: number): void;
  onEnabled(enabled: boolean): void;
  onBackend(backend: GradientBlurBackend): void;
  onPixelRatio(ratio: number): void;
}
const bytes = (value: number) =>
  value >= 1048576
    ? `${(value / 1048576).toFixed(2)} MiB`
    : `${(value / 1024).toFixed(1)} KiB`;

export function PerformancePanel({
  radius,
  enabled,
  backend,
  activeBackend,
  pixelRatio,
  metrics,
  onRadius,
  onEnabled,
  onBackend,
  onPixelRatio,
}: PerformancePanelProps) {
  const scroll = useScrollPerformance();
  const gpu = activeBackend === "rito" || activeBackend === "html-in-canvas";
  return (
    <>
      <GlassCard id="performance" span={12} className={styles.panel}>
        <div className={styles.row}>
          <div className={styles.status}>
            <span className={styles.indicator} data-gpu={gpu} />
            <div>
              <strong>渲染实况</strong>
              <small>
                {gpu
                  ? `WebGL2 · ${activeBackend === "rito" ? "Rito" : "HTML-in-Canvas"}`
                  : "CSS 保底"}
              </small>
            </div>
          </div>
          <div className={styles.reading}>
            <strong>
              {scroll ? Math.round(scroll.fps) : "—"}
              <small> FPS</small>
            </strong>
            <span>
              {scroll?.active ? "滚动中" : scroll ? "上次滚动" : "滚动以测量"}
            </span>
          </div>
          <div className={styles.reading}>
            <strong>
              {Math.round(metrics.area * 100)}
              <small> %</small>
            </strong>
            <span>视口模糊覆盖 · {metrics.cards} 张卡片</span>
          </div>
          <label className={styles.radius}>
            模糊半径 <output>{radius}px</output>
            <input
              aria-label="模糊半径"
              type="range"
              min="0"
              max="96"
              step="1"
              value={radius}
              onChange={(event) => onRadius(Number(event.target.value))}
            />
          </label>
          <button
            type="button"
            className={styles.toggle}
            aria-pressed={!enabled}
            onClick={() => onEnabled(!enabled)}
          >
            <Icon name="grid" size={15} />
            {enabled ? "关闭模糊" : "开启模糊"}
          </button>
        </div>
        <details className={styles.details}>
          <summary>采样与性能详情</summary>
          <div className={styles.detailGrid}>
            <label>
              采集后端
              <select
                aria-label="采集后端"
                value={backend}
                onChange={(event) =>
                  onBackend(event.target.value as GradientBlurBackend)
                }
              >
                <option value="auto">自动选择</option>
                <option value="rito">Rito Canvas</option>
                <option value="html-in-canvas">HTML-in-Canvas</option>
              </select>
            </label>
            <label>
              最大纹理 DPR
              <select
                aria-label="最大纹理 DPR"
                value={pixelRatio}
                onChange={(event) => onPixelRatio(Number(event.target.value))}
              >
                <option value="1">1×</option>
                <option value="2">2×</option>
              </select>
            </label>
            <div>
              <span>采样率 / 纹理块</span>
              <strong>
                {gpu ? `${metrics.scales} / ${metrics.blocks} 块` : "—"}
              </strong>
            </div>
            <div>
              <span>共享图集 / 背景原图</span>
              <strong>
                {gpu
                  ? `${bytes(metrics.atlasBytes)} / ${bytes(metrics.sourceBytes)}`
                  : "—"}
              </strong>
            </div>
            <div>
              <span>最近模糊提交</span>
              <strong>{gpu ? `${metrics.submitMs.toFixed(2)} ms` : "—"}</strong>
            </div>
            <div>
              <span>滚动帧间隔 P95</span>
              <strong>{scroll ? `${scroll.p95.toFixed(1)} ms` : "—"}</strong>
            </div>
          </div>
          <p>
            Provider
            缓存静态背景，同半径卡片共享模糊纹理，滚动只裁切合成。帧率来自页面的
            requestAnimationFrame；提交时间为最近一次 JS 布局和上传耗时，不是
            GPU 耗时。图集数据不含背景、中间缓冲和闲置缓存。
          </p>
        </details>
      </GlassCard>
      {scroll && (
        <aside className={styles.hud} aria-label="滚动性能显示">
          <span className={styles.indicator} data-gpu={gpu} />
          <strong>
            {Math.round(scroll.fps)}
            <small> FPS</small>
          </strong>
          <span>{scroll.active ? "滚动中" : "上次滚动"}</span>
          <a href="#performance" aria-label="返回性能控制">
            <Icon name="arrow" size={15} />
          </a>
        </aside>
      )}
    </>
  );
}
