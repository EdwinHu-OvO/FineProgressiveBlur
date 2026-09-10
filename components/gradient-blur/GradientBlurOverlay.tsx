"use client";

import { useRef } from "react";
import { useGradientBlurContext } from "./GradientBlurProvider";
import { CssGradientBlurFallback } from "./fallback/CssGradientBlurFallback";
import { CssMaskedBlurFallback } from "./fallback/CssMaskedBlurFallback";
import { CssUniformBlurFallback } from "./fallback/CssUniformBlurFallback";
import { resolveOverlayMode } from "./engine/overlay-mode";
import { useBlurMask } from "./mask/useBlurMask";
import type { GradientBlurOverlayProps } from "./types";
import { OVERLAY_SLOT } from "./native/native-host";
import { useSurfaceOverlay } from "./engine/useSurfaceOverlay";

export function GradientBlurOverlay({
  algorithm: overlayAlgorithm,
  blurCurve: overlayBlurCurve,
  captureStrategy = "live",
  className,
  direction,
  height,
  maxRadius = 24,
  mask,
  onMetrics,
  style,
  ...overlayProps
}: GradientBlurOverlayProps) {
  const mode = resolveOverlayMode(direction, mask);
  const {
    fallback,
    surface,
    activeBackend,
    algorithm: providerAlgorithm,
    blurCurve: providerBlurCurve,
  } = useGradientBlurContext();
  const algorithm = overlayAlgorithm ?? providerAlgorithm;
  const blurCurve =
    mode === "gradient" ? (overlayBlurCurve ?? providerBlurCurve) : undefined;
  const cssOnly = activeBackend === "css";
  const overlayRef = useRef<HTMLDivElement>(null);
  const resolvedMask = useBlurMask(mask, fallback === "css");
  const surfacePhase = useSurfaceOverlay({
    surface: mask !== undefined && !resolvedMask?.mask ? null : surface,
    overlayRef,
    direction,
    maxRadius,
    algorithm,
    blurCurve,
    mask: resolvedMask?.mask,
    strategy: captureStrategy,
    onMetrics,
  });
  const phase = resolvedMask?.error
    ? "fallback"
    : cssOnly
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
      data-blur-mode={mode}
      data-mask-error={resolvedMask?.error}
      style={{
        top:
          direction === "bottom" ||
          (direction === undefined && style?.bottom !== undefined)
            ? undefined
            : 0,
        bottom: direction === "bottom" ? 0 : undefined,
        insetInline: 0,
        ...style,
        contain: "layout paint style",
        height: height ?? style?.height ?? (mode === "gradient" ? 100 : "100%"),
        overflow: "hidden",
        pointerEvents: "none",
        position: "absolute",
        zIndex: 2,
      }}
    >
      {fallback === "css" &&
        (mask !== undefined ? (
          <CssMaskedBlurFallback
            mask={mask}
            alphaUrl={resolvedMask?.alphaUrl}
            maxRadius={maxRadius}
          />
        ) : direction !== undefined ? (
          <CssGradientBlurFallback
            direction={direction}
            maxRadius={maxRadius}
            blurCurve={blurCurve}
          />
        ) : (
          <CssUniformBlurFallback maxRadius={maxRadius} />
        ))}
    </div>
  );
}
