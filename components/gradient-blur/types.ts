import type {
  CSSProperties,
  HTMLAttributes,
  ReactNode,
  RefObject,
} from "react";

/** Maximum bilinear reads per Gaussian axis; passes run at each band's resolution. */
export const GRADIENT_BLUR_SAMPLE_COUNT = 13;

export type CaptureStrategy = "static" | "scrollend" | "live";
export type GradientBlurBackend = "auto" | "html-in-canvas" | "rito";
export type GradientBlurActiveBackend =
  "pending" | "html-in-canvas" | "rito" | "css" | "unavailable";
export type GradientBlurDirection = "top" | "bottom";
export type GradientBlurPhase = "idle" | "capturing" | "ready" | "fallback";
export type CaptureReason =
  "initial" | "resize" | "scrollend" | "live" | "manual";
export type GradientBlurAlgorithm = "gaussian13" | "compact9";

export interface GradientBlurBandMetrics {
  label: "outer" | "middle" | "inner";
  scale: number;
  atlasWidth: number;
  atlasHeight: number;
  coreStart: number;
  coreEnd: number;
}

export interface GradientBlurMetrics {
  direction: GradientBlurDirection;
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
  algorithm?: GradientBlurAlgorithm;
  onBackendChange?: (backend: GradientBlurActiveBackend) => void;
  maxDevicePixelRatio?: number;
  fallback?: "css" | "transparent";
}

export interface GradientBlurOverlayProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "children" | "onError"
> {
  direction: GradientBlurDirection;
  height?: number | string;
  maxRadius?: number;
  algorithm?: GradientBlurAlgorithm;
  captureStrategy?: CaptureStrategy;
  onMetrics?: (metrics: GradientBlurMetrics) => void;
}

export interface GradientBlurProfile {
  direction: GradientBlurDirection;
  maxRadius: number;
  algorithm?: GradientBlurAlgorithm;
}

export interface OverlayStyle extends CSSProperties {
  WebkitMaskImage?: string;
  WebkitBackdropFilter?: string;
}
