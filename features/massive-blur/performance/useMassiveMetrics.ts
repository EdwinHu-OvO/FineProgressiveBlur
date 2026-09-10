import { useCallback, useEffect, useRef, useState } from "react";
import type { GradientBlurMetrics } from "@/components/gradient-blur";
import type { CardRegion } from "../surface/card-regions";

const INITIAL = {
  cards: 0,
  area: 0,
  atlasBytes: 0,
  sourceBytes: 0,
  blocks: 0,
  scales: "—",
  submitMs: 0,
  pixelRatio: 1,
};

export function useMassiveMetrics() {
  const record = useRef<GradientBlurMetrics | null>(null);
  const regions = useRef<readonly CardRegion[]>([]);
  const [summary, setSummary] = useState(INITIAL);
  const onMetrics = useCallback((metrics: GradientBlurMetrics) => {
    record.current = metrics;
  }, []);
  const onRegions = useCallback((next: readonly CardRegion[]) => {
    regions.current = next;
  }, []);
  const resetMetrics = useCallback(() => {
    record.current = null;
  }, []);
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.hidden) return;
      const metrics = record.current;
      const area = regions.current.reduce(
        (sum, rect) =>
          sum +
          Math.max(
            0,
            Math.min(rect.x + rect.width, innerWidth) - Math.max(0, rect.x),
          ) *
            Math.max(
              0,
              Math.min(rect.y + rect.height, innerHeight) - Math.max(0, rect.y),
            ),
        0,
      );
      const scales = [
        ...new Set(metrics?.bands.map((band) => band.scale) ?? []),
      ].sort((a, b) => b - a);
      const next = {
        cards: regions.current.length,
        area: area / (innerWidth * innerHeight),
        atlasBytes: metrics?.atlasBytes ?? 0,
        sourceBytes: metrics?.sourceBytes ?? 0,
        blocks: metrics?.bands.length ?? 0,
        scales:
          scales
            .map((scale) => (scale === 1 ? "1×" : `1/${1 / scale}×`))
            .join(" · ") || "—",
        submitMs: metrics ? metrics.atlasBuildMs + metrics.uploadMs : 0,
        pixelRatio: metrics?.pixelRatio ?? 1,
      };
      setSummary((previous) =>
        JSON.stringify(previous) === JSON.stringify(next) ? previous : next,
      );
    }, 500);
    return () => clearInterval(timer);
  }, []);
  return { summary, onMetrics, onRegions, resetMetrics };
}

export type MassiveMetrics = ReturnType<typeof useMassiveMetrics>["summary"];
