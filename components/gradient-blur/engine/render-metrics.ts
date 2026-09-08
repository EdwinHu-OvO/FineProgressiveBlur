import type { GradientBlurMetrics } from "../types";
import { RenderPerformanceTracker } from "./render-performance";

/** Count actual blur draws; reporting cadence never controls render cadence. */
export class RenderMetrics {
  latest: GradientBlurMetrics | null = null;
  private readonly performance = new RenderPerformanceTracker();
  private lastPublished = -Infinity;

  constructor(
    private readonly onMetrics: (metrics: GradientBlurMetrics) => void,
  ) {}

  record(timestamp = performance.now()): void {
    const stats = this.performance.record(timestamp);
    if (!this.latest) return;
    this.latest.renderCount = this.performance.total;
    if (stats) this.latest.renderFps = stats.fps;
  }

  publish(force = false, timestamp = performance.now()): void {
    if (this.latest && (force || timestamp - this.lastPublished >= 400)) {
      this.onMetrics({ ...this.latest });
      this.lastPublished = timestamp;
    }
  }
}
