import type {
  CaptureStrategy,
  GradientBlurDirection,
  GradientBlurMetrics,
  GradientBlurActiveBackend,
} from "@/components/gradient-blur";
import styles from "./controls.module.css";
import { CssRuntimeDiagnostics } from "./CssRuntimeDiagnostics";
import { RuntimeMetric as Metric } from "./RuntimeMetric";

interface RuntimeDiagnosticsProps {
  activeBackend: GradientBlurActiveBackend;
  maxRadius: number;
  directions: Record<GradientBlurDirection, boolean>;
  metrics: Partial<Record<GradientBlurDirection, GradientBlurMetrics>>;
  strategy: CaptureStrategy;
}

function formatBytes(bytes: number): string {
  return bytes ? `${Math.round(bytes / 1024)} KB` : "—";
}

function formatTime(milliseconds: number | null): string {
  if (milliseconds === null) return "—";
  return milliseconds < 0.05 ? "<0.1 ms" : `${milliseconds.toFixed(1)} ms`;
}

export function RuntimeDiagnostics({
  activeBackend,
  maxRadius,
  directions,
  metrics,
  strategy,
}: RuntimeDiagnosticsProps) {
  if (activeBackend === "css")
    return <CssRuntimeDiagnostics maxRadius={maxRadius} />;
  const activeMetrics = Object.values(metrics).filter(
    (entry): entry is GradientBlurMetrics =>
      Boolean(
        entry &&
        directions[entry.direction] &&
        entry.adapterId === activeBackend,
      ),
  );
  const atlasBytes = activeMetrics.reduce(
    (sum, entry) => sum + entry.atlasBytes,
    0,
  );
  const sourceBytes = activeMetrics.reduce(
    (sum, entry) => sum + entry.sourceBytes,
    0,
  );
  const captureMs = activeMetrics.length
    ? Math.max(...activeMetrics.map((entry) => entry.captureMs))
    : null;
  const uploadMs = activeMetrics.length
    ? Math.max(...activeMetrics.map((entry) => entry.uploadMs))
    : null;
  const renderCount = activeMetrics.length
    ? Math.max(...activeMetrics.map((entry) => entry.renderCount))
    : 0;
  const savedRatio = sourceBytes ? 1 - atlasBytes / sourceBytes : 0;
  const latest = activeMetrics.at(-1);

  return (
    <section className={styles.runtime} aria-label="运行时诊断">
      <div className={styles.runtimeStrip}>
        <Metric label="Atlas" value={formatBytes(atlasBytes)} />
        <Metric
          label="Atlas saved"
          value={sourceBytes ? `${Math.round(savedRatio * 100)}%` : "—"}
        />
        <Metric label="Capture" value={formatTime(captureMs)} />
        <Metric label="Texture submit" value={formatTime(uploadMs)} />
        <Metric
          label="Kernel"
          value={`Gaussian ≤${latest?.sampleCount ?? 9} / axis`}
        />
        <Metric
          label="GPU render"
          value={strategy === "live" ? "on content change" : "on demand"}
        />
      </div>

      <details className={styles.diagnostics}>
        <summary>实现细节与边界</summary>
        <div className={styles.diagnosticGrid}>
          <div>
            <h2>非均匀图集</h2>
            <AtlasDiagram metrics={latest} />
            <p>
              按局部标准差与 DPR 选择 1×、½、¼ 及更低分辨率，使每轴卷积至多读取
              {latest?.sampleCount ?? 9} 次。分区保留 3σ 邻域，接缝平滑混合；零半径使用原始分辨率。
            </p>
          </div>
          <div>
            <h2>连续控制场</h2>
            <code className={styles.formula}>
              R(y) = Rmax · (1 − smootherstep(y))
            </code>
            <p>
              半径含义与 CSS blur() 的高斯标准差一致，在正文接缝收敛为 0。
              横向、纵向卷积在 sRGB
              中执行，取消随机旋转采样。渐变控制场使用空间变化的分离式近似。
            </p>
          </div>
          <div>
            <h2>捕获策略</h2>
            <dl className={styles.definitionList}>
              <div>
                <dt>当前</dt>
                <dd>{strategy}</dd>
              </div>
              <div>
                <dt>适配器</dt>
                <dd>{latest?.adapterId ?? "准备中"}</dd>
              </div>
              <div>
                <dt>纹理源</dt>
                <dd>{latest?.liveCapture ?? "snapshot"}</dd>
              </div>
              <div>
                <dt>DPR</dt>
                <dd>{latest?.pixelRatio ?? "—"}</dd>
              </div>
              <div>
                <dt>触发</dt>
                <dd>{latest?.reason ?? "—"}</dd>
              </div>
              <div>
                <dt>渲染帧</dt>
                <dd>{renderCount || "—"}</dd>
              </div>
            </dl>
          </div>
          <div>
            <h2>平台边界</h2>
            {activeBackend === "rito" ? (
              <p>
                Rito 绘制正文，Canvas 2D 结果按块缓存在 GPU。
                命中缓存的滚动只移动采样窗口，选区和焦点直接在 GPU 合成。
                内容变化会重画受影响的块，比较像素后决定是否更新模糊。
                首次绘制、缓存未命中和内容改动仍需要上传；原生 DOM
                保留布局、输入和无障碍语义。
              </p>
            ) : (
              <p>
                支持 HTML-in-Canvas 的浏览器会让 Provider 共用一个 WebGL
                上下文，DOM 纹理直接进入 GPU，再由 GPU 裁剪图集。原生 API
                不可用或失败时改用 Rito；只有 WebGL2 不可用时使用 CSS 保底。
              </p>
            )}
            {activeBackend === "rito" ? (
              <p>
                缓存预算 64 MiB，长文档按需替换旧块。复杂滤镜、嵌入控件、 Shadow
                DOM 等暂不支持的内容会保留原生正文并报告不可用状态。Atlas saved
                仅统计边缘图集， 不包含正文缓存；提取模块保留上游 AGPL-3.0-only
                许可证。
              </p>
            ) : (
              <p>
                耗时记录 JS 调用，不等待 GPU 完成。Atlas saved
                只比较边缘图集，不代表总显存或上传节省。原生路径保留共享正文纹理；Rito
                另外保留正文缓存。 高斯中间缓冲与降采样缓存也不计入 Atlas
                saved。
              </p>
            )}
          </div>
        </div>
      </details>
    </section>
  );
}

function AtlasDiagram({ metrics }: { metrics?: GradientBlurMetrics }) {
  return (
    <div className={styles.atlas} aria-label="实际采样分区">
      {metrics?.bands.map((band) => (
        <span
          key={band.scale}
          style={{ flexGrow: band.coreEnd - band.coreStart }}
        >
          {band.scale === 1 ? "1×" : `1/${Math.round(1 / band.scale)}`}
          <em>{Math.round((band.coreEnd - band.coreStart) * 100)}%</em>
        </span>
      ))}
      <small>
        {metrics
          ? `${metrics.atlasWidth} × ${metrics.atlasHeight}px`
          : "等待纹理"}
      </small>
    </div>
  );
}
