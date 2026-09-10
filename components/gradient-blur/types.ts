import type {
  CSSProperties,
  HTMLAttributes,
  ReactNode,
  RefObject,
} from "react";

/** Maximum bilinear reads per Gaussian axis; passes run at each band's resolution. */
export const GRADIENT_BLUR_SAMPLE_COUNT = 9;

export type CaptureStrategy = "static" | "scrollend" | "live";
export type GradientBlurSourceMode = "live" | "static";
export type GradientBlurBackend = "auto" | "html-in-canvas" | "rito";
export type GradientBlurActiveBackend =
  "pending" | "html-in-canvas" | "rito" | "css" | "unavailable";
export type GradientBlurDirection = "top" | "bottom";
export type GradientBlurMode = "uniform" | "gradient" | "mask";
export type GradientBlurPhase = "idle" | "capturing" | "ready" | "fallback";
export type CaptureReason =
  "initial" | "resize" | "scrollend" | "live" | "manual";
export type GradientBlurAlgorithm = "compact9";

/** Cubic-bezier easing parameters, matching CSS cubic-bezier(x1, y1, x2, y2). */
export interface GradientBlurBezier {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface GradientBlurBandMetrics {
  label: "outer" | "middle" | "inner";
  scale: number;
  atlasWidth: number;
  atlasHeight: number;
  coreStart: number;
  coreEnd: number;
  /** Normalized horizontal core bounds and fixed CSS sigma for mask patches. */
  coreLeft?: number;
  coreRight?: number;
  sigma?: number;
}

export interface GradientBlurMetrics {
  mode: GradientBlurMode;
  direction?: GradientBlurDirection;
  strategy: CaptureStrategy;
  phase: GradientBlurPhase;
  captureCount: number;
  captureMs: number;
  atlasBuildMs: number;
  uploadMs: number;
  atlasWidth: number;
  atlasHeight: number;
  atlasBytes: number;
  sourceBytes: number;
  savedRatio: number;
  pixelRatio: number;
  sampleCount: number;
  renderCount: number;
  renderFps: number;
  liveCapture: "continuous" | "snapshot";
  adapterId: string;
  reason?: CaptureReason;
  error?: string;
  bands: readonly GradientBlurBandMetrics[];
  /** Provider-owned uniform texture identity; equal keys share one allocation. */
  sharedTexture?: string;
}

export interface GradientBlurProviderHandle {
  refresh(): void;
}

export interface GradientBlurProviderProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "children"
> {
  children: ReactNode;
  sourceRef?: RefObject<HTMLElement | null>;
  captureBackend?: GradientBlurBackend;
  /** Static sources update on initialization, size/DPR changes and ref.refresh(). */
  sourceMode?: GradientBlurSourceMode;
  algorithm?: GradientBlurAlgorithm;
  blurCurve?: GradientBlurBezier;
  onBackendChange?: (backend: GradientBlurActiveBackend) => void;
  maxDevicePixelRatio?: number;
  /** Visual baseline until an overlay has a valid WebGL frame. */
  fallback?: "css" | "transparent";
}

interface GradientBlurOverlayBaseProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "children" | "onError"
> {
  /** Defaults to 100px for direction gradients, otherwise the full container. */
  height?: number | string;
  /** CSS sigma: constant in uniform mode, maximum in gradient and mask modes. */
  maxRadius?: number;
  algorithm?: GradientBlurAlgorithm;
  /** Only applies when direction selects the gradient pipeline. */
  blurCurve?: GradientBlurBezier;
  captureStrategy?: CaptureStrategy;
  onMetrics?: (metrics: GradientBlurMetrics) => void;
}

/** Omit both selectors for uniform blur. Direction and mask are exclusive. */
export type GradientBlurOverlayProps = GradientBlurOverlayBaseProps &
  (
    | { direction: GradientBlurDirection; mask?: never }
    | { direction?: never; mask?: import("./mask/types").BlurMask }
  );

export interface GradientBlurProfile {
  direction: GradientBlurDirection;
  maxRadius: number;
  algorithm?: GradientBlurAlgorithm;
  blurCurve?: GradientBlurBezier;
}

export interface OverlayStyle extends CSSProperties {
  WebkitMaskImage?: string;
  WebkitBackdropFilter?: string;
}
