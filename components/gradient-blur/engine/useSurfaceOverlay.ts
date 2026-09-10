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
import type { ResolvedBlurMask } from "../mask/types";
import { observeOverlayLayout } from "./observe-overlay-layout";

interface SurfaceOverlayHookOptions {
  surface: BlurSurface | null;
  overlayRef: RefObject<HTMLDivElement | null>;
  direction?: GradientBlurDirection;
  maxRadius: number;
  algorithm?: import("../types").GradientBlurAlgorithm;
  blurCurve?: GradientBlurBezier;
  mask?: ResolvedBlurMask;
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
  mask,
  strategy,
  onMetrics,
}: SurfaceOverlayHookOptions): GradientBlurPhase {
  // Callers commonly create curve literals inline. Compare their values rather
  // than object identity so diagnostic renders do not re-register the overlay.
  const curveX1 = blurCurve?.x1;
  const curveY1 = blurCurve?.y1;
  const curveX2 = blurCurve?.x2;
  const curveY2 = blurCurve?.y2;
  const stableBlurCurve = useMemo(
    () =>
      curveX1 === undefined ||
      curveY1 === undefined ||
      curveX2 === undefined ||
      curveY2 === undefined
        ? undefined
        : { x1: curveX1, y1: curveY1, x2: curveX2, y2: curveY2 },
    [curveX1, curveY1, curveX2, curveY2],
  );
  const registration = useMemo(
    () => ({
      surface,
      direction,
      algorithm,
      blurCurve: stableBlurCurve,
      mask,
      strategy,
    }),
    [surface, direction, algorithm, strategy, stableBlurCurve, mask],
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
    const unobserve = observeOverlayLayout(element, () =>
      surface.requestOverlay(element),
    );
    return () => {
      active = false;
      unobserve();
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
    curveX1,
    curveY1,
    curveX2,
    curveY2,
    mask,
  ]);
  return status?.registration === registration ? status.phase : "capturing";
}
