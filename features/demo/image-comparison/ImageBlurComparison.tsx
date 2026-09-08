import { useState, type CSSProperties } from "react";
import { RangeControl } from "../RangeControl";
import { COMPARISON_MAX_RADIUS, COMPARISON_PADDING } from "./image-source";
import { useImageComparison } from "./useImageComparison";
import styles from "./image-comparison.module.css";
import type { GradientBlurAlgorithm } from "@/components/gradient-blur";

export function ImageBlurComparison({
  algorithm,
}: {
  algorithm: GradientBlurAlgorithm;
}) {
  const [radius, setRadius] = useState(12);
  const [showOriginal, setShowOriginal] = useState(false);
  const effectiveRadius = showOriginal ? 0 : radius;
  const { sourceRef, outputRef, status } = useImageComparison(
    effectiveRadius,
    algorithm,
  );
  const hasImage = status === "ready" || status === "webgl-unavailable";
  const loadingMessage =
    status === "image-error" ? "图片加载失败" : "正在加载图片…";

  return (
    <section
      id="image-blur-comparison"
      className={styles.comparison}
      aria-labelledby="image-comparison-title"
      data-status={status}
      style={
        { "--comparison-padding": `${COMPARISON_PADDING}px` } as CSSProperties
      }
    >
      <header className={styles.header}>
        <div>
          <h2 id="image-comparison-title">图片模糊对照</h2>
          <p>同一张图片，整幅固定半径。</p>
        </div>
        <div className={styles.controls}>
          <RangeControl
            id="image-blur-radius"
            label="模糊半径"
            min={0}
            max={COMPARISON_MAX_RADIUS}
            value={radius}
            onChange={(value) => {
              setRadius(value);
              setShowOriginal(false);
            }}
          />
          <button
            type="button"
            aria-pressed={showOriginal}
            onClick={() => setShowOriginal((current) => !current)}
          >
            {showOriginal ? "恢复模糊" : "查看原图"}
          </button>
        </div>
      </header>

      <div className={styles.images}>
        <figure className={styles.panel}>
          <figcaption>
            <span>当前算法</span>
            <code>
              {algorithm === "gaussian13" ? "高斯 13" : "紧凑高斯 9"} ·{" "}
              {effectiveRadius}px
            </code>
          </figcaption>
          <div className={styles.frame}>
            <canvas
              ref={outputRef}
              className={styles.canvas}
              style={{ visibility: status === "ready" ? "visible" : "hidden" }}
              role="img"
              aria-label="当前算法模糊的山间湖泊与木屋"
            />
            {status !== "ready" && (
              <p className={styles.message} role="status">
                {status === "webgl-unavailable"
                  ? "WebGL2 不可用，无法显示算法对照"
                  : loadingMessage}
              </p>
            )}
          </div>
        </figure>
        <figure className={styles.panel}>
          <figcaption>
            <span>普通 CSS</span>
            <code>blur({effectiveRadius}px)</code>
          </figcaption>
          <div className={styles.frame}>
            <canvas
              ref={sourceRef}
              className={styles.canvas}
              style={{
                filter: `blur(${effectiveRadius}px)`,
                visibility: hasImage ? "visible" : "hidden",
              }}
              role="img"
              aria-label="普通 CSS 模糊的山间湖泊与木屋"
            />
            {!hasImage && (
              <p className={styles.message} role="status">
                {loadingMessage}
              </p>
            )}
          </div>
        </figure>
      </div>
      <footer className={styles.footer}>
        <p>
          两侧使用相同图片、裁切与高斯标准差。当前算法按半径调整计算分辨率，保持确定性采样。
        </p>
        <a
          href="https://unsplash.com/photos/brown-house-near-body-of-water-zAjdgNXsMeg"
          target="_blank"
          rel="noreferrer"
        >
          Luca Bravo / Unsplash ↗
        </a>
      </footer>
    </section>
  );
}
