"use client";

import { useCallback, useState } from "react";
import type {
  CaptureStrategy,
  GradientBlurDirection,
  GradientBlurMetrics,
  GradientBlurBackend,
  GradientBlurActiveBackend,
  GradientBlurAlgorithm,
} from "@/components/gradient-blur";
import { BlurControls } from "./BlurControls";
import { DemoViewport } from "./DemoViewport";
import { RuntimeDiagnostics } from "./RuntimeDiagnostics";
import { ImageBlurComparison } from "./image-comparison/ImageBlurComparison";
import styles from "./demo-shell.module.css";

const INITIAL_DIRECTIONS = { top: true, bottom: true };

export function GradientBlurDemo() {
  const [backend, setBackend] = useState<GradientBlurBackend>("auto");
  const [activeBackend, setActiveBackend] =
    useState<GradientBlurActiveBackend>("pending");
  const [height, setHeight] = useState(112);
  const [maxRadius, setMaxRadius] = useState(28);
  const [strategy, setStrategy] = useState<CaptureStrategy>("live");
  const [algorithm, setAlgorithm] =
    useState<GradientBlurAlgorithm>("gaussian13");
  const [directions, setDirections] = useState(INITIAL_DIRECTIONS);
  const [effectEnabled, setEffectEnabled] = useState(true);
  const [metrics, setMetrics] = useState<
    Partial<Record<GradientBlurDirection, GradientBlurMetrics>>
  >({});

  const toggleDirection = useCallback((direction: GradientBlurDirection) => {
    setDirections((current) => ({
      ...current,
      [direction]: !current[direction],
    }));
  }, []);

  const updateMetrics = useCallback((nextMetrics: GradientBlurMetrics) => {
    setMetrics((current) => ({
      ...current,
      [nextMetrics.direction]: nextMetrics,
    }));
  }, []);

  const reset = useCallback(() => {
    setBackend("auto");
    setHeight(112);
    setMaxRadius(28);
    setStrategy("live");
    setAlgorithm("gaussian13");
    setDirections(INITIAL_DIRECTIONS);
    setEffectEnabled(true);
  }, []);

  const activeDirections = (
    Object.keys(INITIAL_DIRECTIONS) as GradientBlurDirection[]
  ).filter((direction) => directions[direction]);
  const activeMetrics = activeDirections
    .map((direction) => metrics[direction])
    .filter((entry) => entry?.adapterId === activeBackend);
  const isReady =
    activeBackend === "css" ||
    (activeMetrics.length > 0 &&
      activeMetrics.every((entry) => entry?.phase === "ready"));

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>WebGL progressive blur</p>
          <h1>Fine Progressive Blur</h1>
          <p className={styles.intro}>局部纹理、连续半径、原生交互。</p>
        </div>
        <div className={styles.engineStatus} data-ready={isReady}>
          <span aria-hidden="true" />
          {activeBackend === "css"
            ? "CSS 分层模糊"
            : isReady
              ? "WebGL2 已就绪"
              : activeBackend === "unavailable"
                ? "纹理后端不可用"
                : "正在准备纹理"}
        </div>
      </header>

      <section className={styles.workbench} aria-label="渐变模糊演示工作台">
        <DemoViewport
          backend={backend}
          onBackendChange={setActiveBackend}
          directions={directions}
          effectEnabled={effectEnabled}
          height={height}
          maxRadius={maxRadius}
          algorithm={algorithm}
          strategy={strategy}
          onMetrics={updateMetrics}
          onToggleEffect={() => setEffectEnabled((enabled) => !enabled)}
        />
        <BlurControls
          backend={backend}
          activeBackend={activeBackend}
          onBackendChange={setBackend}
          directions={directions}
          height={height}
          maxRadius={maxRadius}
          algorithm={algorithm}
          onAlgorithmChange={setAlgorithm}
          strategy={strategy}
          onHeightChange={setHeight}
          onRadiusChange={setMaxRadius}
          onReset={reset}
          onStrategyChange={setStrategy}
          onToggleDirection={toggleDirection}
        />
      </section>

      <RuntimeDiagnostics
        activeBackend={activeBackend}
        maxRadius={maxRadius}
        directions={directions}
        metrics={metrics}
        strategy={strategy}
      />
      <ImageBlurComparison algorithm={algorithm} />
    </main>
  );
}
