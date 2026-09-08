"use client";

import { useRef } from "react";
import {
  GradientBlurOverlay,
  GradientBlurProvider,
  type CaptureStrategy,
  type GradientBlurBackend,
  type GradientBlurActiveBackend,
  type GradientBlurDirection,
  type GradientBlurMetrics,
  type GradientBlurAlgorithm,
} from "@/components/gradient-blur";
import { DemoScrollContent } from "./DemoScrollContent";
import styles from "./demo-stage.module.css";

interface DemoViewportProps {
  backend: GradientBlurBackend;
  onBackendChange: (backend: GradientBlurActiveBackend) => void;
  directions: Record<GradientBlurDirection, boolean>;
  effectEnabled: boolean;
  height: number;
  maxRadius: number;
  algorithm: GradientBlurAlgorithm;
  strategy: CaptureStrategy;
  onMetrics: (metrics: GradientBlurMetrics) => void;
  onToggleEffect: () => void;
}

export function DemoViewport({
  backend,
  onBackendChange,
  directions,
  effectEnabled,
  height,
  maxRadius,
  algorithm,
  strategy,
  onMetrics,
  onToggleEffect,
}: DemoViewportProps) {
  const sourceRef = useRef<HTMLDivElement>(null);

  return (
    <div className={styles.previewColumn}>
      <div className={styles.previewToolbar}>
        <div>
          <span className={styles.liveDot} aria-hidden="true" />
          实时视口 · 原生交互
        </div>
        <button
          type="button"
          aria-pressed={!effectEnabled}
          onClick={onToggleEffect}
        >
          {effectEnabled ? "查看原图" : "恢复效果"}
        </button>
      </div>

      <GradientBlurProvider
        captureBackend={backend}
        onBackendChange={onBackendChange}
        className={styles.provider}
        sourceRef={sourceRef}
        fallback="css"
        maxDevicePixelRatio={2}
        algorithm={algorithm}
      >
        {effectEnabled && directions.top ? (
          <GradientBlurOverlay
            captureStrategy={strategy}
            direction="top"
            height={height}
            maxRadius={maxRadius}
            algorithm={algorithm}
            onMetrics={onMetrics}
          />
        ) : null}

        <div
          ref={sourceRef}
          className={styles.scroller}
          data-gradient-blur-source=""
          role="region"
          tabIndex={0}
          aria-label="可滚动的模糊效果示例内容"
          style={{ scrollPaddingBlock: height }}
        >
          <DemoScrollContent />
        </div>

        {effectEnabled && directions.bottom ? (
          <GradientBlurOverlay
            captureStrategy={strategy}
            direction="bottom"
            height={height}
            maxRadius={maxRadius}
            algorithm={algorithm}
            onMetrics={onMetrics}
          />
        ) : null}
      </GradientBlurProvider>

      <p className={styles.interactionHint}>
        遮罩不接管输入；可以直接滚动、选中文字或操作正文按钮。
      </p>
    </div>
  );
}
