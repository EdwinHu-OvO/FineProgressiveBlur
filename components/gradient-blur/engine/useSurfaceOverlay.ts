"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type {
  CaptureStrategy,
  GradientBlurDirection,
  GradientBlurMetrics,
  GradientBlurPhase,
  GradientBlurBezier,
} from "../types";
import type { BlurSurface } from "./blur-surface";

interface SurfaceOverlayHookOptions {
  surface: BlurSurface | null;
  overlayRef: RefObject<HTMLDivElement | null>;
  direction: GradientBlurDirection;
  maxRadius: number;
  algorithm?: import("../types").GradientBlurAlgorithm;
  blurCurve?: GradientBlurBezier;
  strategy: CaptureStrategy;
  onMetrics?: (metrics: GradientBlurMetrics) => void;
}

export function useSurfaceOverlay({
  surface,
  overlayRef,
  direction,
  maxRadius,
  algorithm,
  blurCurve,
  strategy,
  onMetrics,
}: SurfaceOverlayHookOptions): GradientBlurPhase {
  const [phase, setPhase] = useState<GradientBlurPhase>("capturing");
  const callback = useRef(onMetrics);
  useEffect(() => {
    callback.current = onMetrics;
  }, [onMetrics]);
  useEffect(() => {
    const element = overlayRef.current;
    if (!surface || !element) return;
    return surface.register({
      element,
      direction,
      maxRadius: 0,
      algorithm,
      blurCurve,
      strategy,
      onPhase: (nextPhase) => {
        element.style.setProperty(
          "--gradient-blur-ready",
          nextPhase === "ready" ? "1" : "0",
        );
        setPhase(nextPhase);
      },
      onMetrics: (metrics) => callback.current?.(metrics),
    });
  }, [surface, overlayRef, direction, strategy, algorithm, blurCurve]);
  useEffect(() => {
    const element = overlayRef.current;
    if (element) surface?.setRadius(element, maxRadius);
  }, [
    surface,
    overlayRef,
    direction,
    strategy,
    maxRadius,
    algorithm,
    blurCurve,
  ]);
  return phase;
}
