import type { GradientBlurBezier, GradientBlurDirection } from "../types";
import { blurRadiusAt } from "../engine/profile";

export const CSS_BLUR_LAYERS = 8;

interface CssBlurLayer {
  radius: number;
  start: number;
  fullStart: number;
  fullEnd: number;
  end: number;
  fadeOut: boolean;
}

/** Masks progress from the clear content edge toward the blurred outer edge. */
export function createBlurLayers(
  maxRadius: number,
  curve?: GradientBlurBezier,
): CssBlurLayer[] {
  const radius = Number.isFinite(maxRadius) ? Math.max(0, maxRadius) : 0;
  if (!radius) return [];
  return Array.from({ length: CSS_BLUR_LAYERS }, (_, index) => ({
    radius: curve
      ? blurRadiusAt(
          1 - (index + 0.5) / CSS_BLUR_LAYERS,
          radius,
          curve,
        )
      : radius / 2 ** (CSS_BLUR_LAYERS - index - 1),
    start: index / CSS_BLUR_LAYERS,
    fullStart: (index + 1) / CSS_BLUR_LAYERS,
    fullEnd: Math.min(1, (index + 2) / CSS_BLUR_LAYERS),
    end: Math.min(1, (index + 3) / CSS_BLUR_LAYERS),
    fadeOut: index < CSS_BLUR_LAYERS - 2,
  }));
}

export function layerMask(
  layer: CssBlurLayer,
  direction: GradientBlurDirection,
): string {
  const stops = [
    `transparent ${layer.start * 100}%`,
    `black ${layer.fullStart * 100}%`,
    `black ${layer.fullEnd * 100}%`,
  ];
  if (layer.fadeOut) stops.push(`transparent ${layer.end * 100}%`);
  return `linear-gradient(${direction === "top" ? "to top" : "to bottom"}, ${stops.join(", ")})`;
}
