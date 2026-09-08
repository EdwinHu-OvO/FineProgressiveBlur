export interface RenderPerformanceSnapshot {
  fps: number;
  frameTimeMs: number;
  totalFrames: number;
}

const REPORT_INTERVAL_MS = 500;

export class RenderPerformanceTracker {
  private frameCount = 0;
  private startedAt = Number.NEGATIVE_INFINITY;
  private totalFrames = 0;

  get total(): number {
    return this.totalFrames;
  }

  reset(timestamp = performance.now()): void {
    this.frameCount = 0;
    this.startedAt = timestamp;
    this.totalFrames = 0;
  }

  record(timestamp: number): RenderPerformanceSnapshot | null {
    if (!Number.isFinite(this.startedAt)) this.reset(timestamp);

    this.frameCount += 1;
    this.totalFrames += 1;
    const elapsed = timestamp - this.startedAt;
    if (elapsed < REPORT_INTERVAL_MS) return null;

    const snapshot = {
      fps: (this.frameCount * 1000) / elapsed,
      frameTimeMs: elapsed / this.frameCount,
      totalFrames: this.totalFrames,
    };
    this.frameCount = 0;
    this.startedAt = timestamp;
    return snapshot;
  }
}
