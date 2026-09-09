import { createBlurLayers } from "@/components/gradient-blur/fallback/layered-blur";
import { RuntimeMetric } from "./RuntimeMetric";
import styles from "./controls.module.css";

export function CssRuntimeDiagnostics({ maxRadius }: { maxRadius: number }) {
  const layers = createBlurLayers(maxRadius);
  return (
    <section className={styles.runtime} aria-label="运行时诊断">
      <div
        className={styles.runtimeStrip}
        style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}
      >
        <RuntimeMetric label="Backend" value="CSS" />
        <RuntimeMetric label="Layers" value={`${layers.length} / edge`} />
        <RuntimeMetric label="Texture capture" value="none" />
      </div>
      <details className={styles.diagnostics}>
        <summary>实现细节与边界</summary>
        <div className={styles.diagnosticGrid}>
          <div>
            <h2>分层合成</h2>
            <code className={styles.formula}>Rᵢ = Rmax / 2^(7 − i)</code>
            <p>
              每个边缘最多 8 层，半径逐层翻倍。相邻 mask
              重叠，从正文内缘的清晰区域过渡到外缘的最大模糊。
            </p>
          </div>
          <div>
            <h2>浏览器直接绘制</h2>
            <p>
              默认使用 CSS 保底，WebGL 管线完成首帧后关闭 CSS；
              管线不可用时继续由浏览器绘制。各层均穿透指针事件，滚动和正文交互保持原样。
            </p>
          </div>
        </div>
      </details>
    </section>
  );
}
