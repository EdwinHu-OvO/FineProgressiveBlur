import type { BlurMask, ResolvedBlurMask } from "../mask/types";
import type {
  GradientBlurDirection,
  GradientBlurMode,
  GradientBlurProfile,
} from "../types";

export interface OverlayRenderProfile extends Omit<
  GradientBlurProfile,
  "direction"
> {
  direction?: GradientBlurDirection;
}

export function resolveOverlayMode(
  direction?: GradientBlurDirection,
  mask?: BlurMask | ResolvedBlurMask,
): GradientBlurMode {
  if (direction !== undefined && mask !== undefined)
    throw new Error(
      "GradientBlurOverlay: direction and mask are mutually exclusive",
    );
  if (direction !== undefined) return "gradient";
  return mask === undefined ? "uniform" : "mask";
}

/** GPU texture orientation is independent of the public mode selector. */
export function renderProfile(
  profile: OverlayRenderProfile,
): GradientBlurProfile {
  return {
    ...profile,
    direction: profile.direction ?? "top",
    maxRadius: Number.isFinite(profile.maxRadius)
      ? Math.max(0, profile.maxRadius)
      : 0,
    blurCurve: profile.direction === undefined ? undefined : profile.blurCurve,
  };
}
