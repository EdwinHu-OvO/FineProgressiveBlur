"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
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
  const registration = useMemo(
    () => ({ surface, direction, algorithm, blurCurve, strategy }),
    [surface, direction, algorithm, blurCurve, strategy],
  );
  const [status, setStatus] = useState<{
    registration: typeof registration;
    phase: GradientBlurPhase;
  } | null>(null);
  const callback = useRef(onMetrics);
  useEffect(() => {
    callback.current = onMetrics;
  }, [onMetrics]);
  useLayoutEffect(() => {
    const element = overlayRef.current;
    if (!element) return;
    const resetFallback = () =>
      element.style.removeProperty("--gradient-blur-fallback-display");
    resetFallback();
    const { surface, ...profile } = registration;
    if (!surface) return;
    let active = true;
    const unregister = surface.register({
      ...profile,
      element,
      maxRadius: 0,
      onPhase: (nextPhase) => {
        if (!active) return;
        // Switch in the paint callback so CSS and WebGL never blur together
        // while waiting for React to commit the diagnostic phase update.
        element.style.setProperty(
          "--gradient-blur-fallback-display",
          nextPhase === "ready" ? "none" : "block",
        );
        setStatus({ registration, phase: nextPhase });
      },
      onMetrics: (metrics) => callback.current?.(metrics),
    });
    return () => {
      active = false;
      unregister();
      resetFallback();
    };
  }, [registration, overlayRef]);
  useLayoutEffect(() => {
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
  return status?.registration === registration ? status.phase : "capturing";
}
