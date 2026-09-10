import { useEffect, useState } from "react";

/** Samples the browser frame cadence while scrolling; it is not a GPU timer. */
export function useScrollPerformance() {
  const [sample, setSample] = useState<{
    fps: number;
    p95: number;
    active: boolean;
  }>();
  useEffect(() => {
    let frame = 0,
      until = 0,
      previous = 0,
      published = 0;
    const intervals: number[] = [];
    const publish = (active: boolean) => {
      if (intervals.length < 2) return;
      const sorted = [...intervals].sort((a, b) => a - b);
      setSample({
        fps:
          (1000 * intervals.length) /
          intervals.reduce((sum, value) => sum + value, 0),
        p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
        active,
      });
    };
    const tick = (now: number) => {
      if (document.hidden) {
        frame = 0;
        return;
      }
      if (previous) intervals.push(now - previous);
      if (intervals.length > 90) intervals.shift();
      previous = now;
      const active = now < until;
      if (!active || now - published > 400) {
        publish(active);
        published = now;
      }
      frame = active ? requestAnimationFrame(tick) : 0;
    };
    const scroll = () => {
      until = performance.now() + 180;
      if (!frame) {
        previous = 0;
        intervals.length = 0;
        frame = requestAnimationFrame(tick);
      }
    };
    window.addEventListener("scroll", scroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scroll);
    };
  }, []);
  return sample;
}
