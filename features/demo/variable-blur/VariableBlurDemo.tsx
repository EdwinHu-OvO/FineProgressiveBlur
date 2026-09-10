"use client";

import { useEffect, useState } from "react";
import { sitePath } from "@/lib/site-path";
import {
  GradientBlurOverlay,
  GradientBlurProvider,
  type GradientBlurBackend,
  type GradientBlurMetrics,
} from "@/components/gradient-blur";
import { DemoScrollContent } from "../DemoScrollContent";
import { RangeControl } from "../RangeControl";
import stage from "../demo-stage.module.css";
import styles from "./variable-blur.module.css";

export function VariableBlurDemo({
  backend,
}: {
  backend: GradientBlurBackend;
}) {
  const [preset, setPreset] = useState("/masks/focus.svg");
  const [upload, setUpload] = useState<{ name: string; url: string } | null>(
    null,
  );
  const [radius, setRadius] = useState(24);
  const [enabled, setEnabled] = useState(true);
  const [invert, setInvert] = useState(false);
  const [channel, setChannel] = useState<"luminance" | "alpha">("luminance");
  const [metrics, setMetrics] = useState<GradientBlurMetrics>();
  useEffect(() => {
    if (!upload) return;
    return () => URL.revokeObjectURL(upload.url);
  }, [upload]);
  const source =
    upload?.url ??
    (preset === "uniform" ? undefined : sitePath(preset as `/${string}`));
  const scales = [...new Set(metrics?.bands.map((band) => band.scale))].sort(
    (a, b) => b - a,
  );

  return (
    <section
      className={styles.section}
      id="variable-blur"
      aria-labelledby="variable-blur-heading"
    >
      <header className={styles.header}>
        <div>
          <h2 id="variable-blur-heading">蒙版控制模糊</h2>
          <p>黑色保持清晰，白色达到最大半径。灰度控制两者之间的模糊强度。</p>
        </div>
        <button
          type="button"
          onClick={() => setEnabled(!enabled)}
          aria-pressed={!enabled}
        >
          {enabled ? "查看原图" : "恢复模糊"}
        </button>
      </header>
      <div className={styles.workbench}>
        <GradientBlurProvider
          captureBackend={backend}
          className={styles.provider}
        >
          <GradientBlurOverlay
            mask={source ? { source, channel, invert } : undefined}
            maxRadius={enabled ? radius : 0}
            onMetrics={setMetrics}
          />
          <div
            data-gradient-blur-source=""
            className={stage.scroller}
            tabIndex={0}
            role="region"
            aria-label="可滚动的任意蒙版模糊示例"
          >
            <DemoScrollContent />
          </div>
        </GradientBlurProvider>
        <div className={styles.controls}>
          <label className={styles.field}>
            蒙版
            <select
              value={upload ? "upload" : preset}
              onChange={(event) => {
                setPreset(event.target.value);
                setUpload(null);
              }}
            >
              <option value="uniform">不使用蒙版 · 全模糊</option>
              <option value="/masks/focus.svg">偏心焦点</option>
              <option value="/masks/islands.svg">独立模糊区域</option>
              <option value="/masks/window.svg">清晰窗口 · 硬边界</option>
              {upload && <option value="upload">{upload.name}</option>}
            </select>
          </label>
          {source && (
            <div
              className={styles.maskPreview}
              role="img"
              aria-label="输入蒙版预览"
              style={{ backgroundImage: `url(${JSON.stringify(source)})` }}
            />
          )}
          <label className={styles.upload}>
            选择图片或 SVG
            <input
              type="file"
              accept="image/*,.svg"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file)
                  setUpload({
                    name: file.name,
                    url: URL.createObjectURL(file),
                  });
                event.target.value = "";
              }}
            />
          </label>
          <RangeControl
            id="mask-radius"
            label="最大半径"
            value={radius}
            min={0}
            max={48}
            onChange={setRadius}
          />
          <div className={styles.options}>
            <label>
              <input
                type="checkbox"
                disabled={!source}
                checked={invert}
                onChange={(event) => setInvert(event.target.checked)}
              />
              反转
            </label>
            <label>
              <input
                type="checkbox"
                disabled={!source}
                checked={channel === "alpha"}
                onChange={(event) =>
                  setChannel(event.target.checked ? "alpha" : "luminance")
                }
              />
              Alpha 通道
            </label>
          </div>
          <details className={styles.diagnostics}>
            <summary>采样详情</summary>
            {metrics ? (
              <dl>
                <div>
                  <dt>采集块</dt>
                  <dd>{metrics.bands.length}</dd>
                </div>
                <div>
                  <dt>图集</dt>
                  <dd>
                    {metrics.atlasWidth} × {metrics.atlasHeight}
                  </dd>
                </div>
                <div>
                  <dt>分块 / 缓存查询</dt>
                  <dd>{metrics.atlasBuildMs.toFixed(2)} ms</dd>
                </div>
                <div>
                  <dt>采样率</dt>
                  <dd>
                    {scales
                      .map((scale) => (scale === 1 ? "1×" : `1/${1 / scale}×`))
                      .join(" · ")}
                  </dd>
                </div>
              </dl>
            ) : (
              <p>等待纹理后端就绪。</p>
            )}
          </details>
        </div>
      </div>
    </section>
  );
}
