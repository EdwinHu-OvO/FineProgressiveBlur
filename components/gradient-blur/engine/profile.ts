import type { GradientBlurBezier } from "../types";

export function smootherStep(value: number): number {
  const clamped = Math.min(1, Math.max(0, value));
  return clamped * clamped * clamped * (clamped * (clamped * 6 - 15) + 10);
}

export function blurProfile(
  edgeProgress: number,
  curve?: GradientBlurBezier,
): number {
  if (!curve) return 1 - smootherStep(edgeProgress);
  return Math.max(
    0,
    Math.min(1, 1 - cubicBezierProgress(edgeProgress, normalizeBezier(curve))),
  );
}

export function blurRadiusAt(
  edgeProgress: number,
  maxRadius: number,
  curve?: GradientBlurBezier,
): number {
  return Math.max(0, maxRadius) * blurProfile(edgeProgress, curve);
}

function cubicBezierProgress(x: number, curve: GradientBlurBezier): number {
  const target = Math.min(1, Math.max(0, x));
  if (target === 0 || target === 1) return target;
  let low = 0;
  let high = 1;
  for (let index = 0; index < 18; index += 1) {
    const t = (low + high) / 2;
    if (bezierCoordinate(t, curve.x1, curve.x2) < target) low = t;
    else high = t;
  }
  return Math.min(
    1,
    Math.max(0, bezierCoordinate((low + high) / 2, curve.y1, curve.y2)),
  );
}

function bezierCoordinate(t: number, first: number, second: number): number {
  const oneMinus = 1 - t;
  return (
    3 * oneMinus * oneMinus * t * first +
    3 * oneMinus * t * t * second +
    t * t * t
  );
}

export function normalizeBezier(curve: GradientBlurBezier): GradientBlurBezier {
  const finite = (value: number, fallback: number) =>
    Number.isFinite(value) ? value : fallback;
  return {
    x1: Math.min(1, Math.max(0, finite(curve.x1, 0))),
    y1: finite(curve.y1, 0),
    x2: Math.min(1, Math.max(0, finite(curve.x2, 1))),
    y2: finite(curve.y2, 1),
  };
}
