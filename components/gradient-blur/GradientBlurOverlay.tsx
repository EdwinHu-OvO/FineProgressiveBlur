"use client";

import { useRef } from "react";
import { useGradientBlurContext } from "./GradientBlurProvider";
import { CssGradientBlurFallback } from "./fallback/CssGradientBlurFallback";
import type { GradientBlurOverlayProps } from "./types";
import { OVERLAY_SLOT } from "./native/native-host";
import { useSurfaceOverlay } from "./engine/useSurfaceOverlay";

export function GradientBlurOverlay({
  algorithm: overlayAlgorithm,
  blurCurve: overlayBlurCurve,
  captureStrategy = "live",
  className,
  direction,
  height = 100,
  maxRadius = 24,
  onMetrics,
  style,
  ...overlayProps
}: GradientBlurOverlayProps) {
  const {
    fallback,
    surface,
    activeBackend,
    algorithm: providerAlgorithm,
    blurCurve: providerBlurCurve,
  } = useGradientBlurContext();
  const algorithm = overlayAlgorithm ?? providerAlgorithm;
  const blurCurve = overlayBlurCurve ?? providerBlurCurve;
  const cssOnly = activeBackend === "css";
  const overlayRef = useRef<HTMLDivElement>(null);
  const surfacePhase = useSurfaceOverlay({
    surface,
    overlayRef,
    direction,
    maxRadius,
    algorithm,
    blurCurve,
    strategy: captureStrategy,
    onMetrics,
  });
  const phase = cssOnly
    ? "ready"
    : activeBackend === "pending"
      ? "capturing"
      : surface
        ? surfacePhase
        : "unavailable";

  return (
    <div
      {...overlayProps}
      ref={overlayRef}
      slot={OVERLAY_SLOT}
      aria-hidden="true"
      className={className}
      data-gradient-blur-overlay=""
      data-phase={phase}
      data-direction={direction}
      style={{
        ...style,
        contain: "layout paint style",
        height,
        insetInline: 0,
        overflow: "hidden",
        pointerEvents: "none",
        position: "absolute",
        [direction]: 0,
        zIndex: 2,
      }}
    >
      {fallback === "css" && (
        <CssGradientBlurFallback
          direction={direction}
          maxRadius={maxRadius}
          blurCurve={blurCurve}
        />
      )}
    </div>
  );
}
