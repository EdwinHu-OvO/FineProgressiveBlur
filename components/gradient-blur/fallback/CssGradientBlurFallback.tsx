import type { GradientBlurBezier, GradientBlurDirection } from "../types";
import { createBlurLayers, layerMask } from "./layered-blur";

interface CssGradientBlurFallbackProps {
  direction: GradientBlurDirection;
  maxRadius: number;
  blurCurve?: GradientBlurBezier;
}

export function CssGradientBlurFallback({
  direction,
  maxRadius,
  blurCurve,
}: CssGradientBlurFallbackProps) {
  return (
    <div
      data-gradient-blur-fallback=""
      style={{
        inset: 0,
        position: "absolute",
        pointerEvents: "none",
        // No container mask/filter or opacity animation: descendants must be
        // able to sample the real backdrop, not an isolated intermediate root.
      }}
    >
      {createBlurLayers(maxRadius, blurCurve).map((layer, index) => {
        const mask = layerMask(layer, direction);
        return (
          <div
            key={index}
            data-gradient-blur-layer={index}
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              zIndex: index + 1,
              backdropFilter: `blur(${layer.radius}px)`,
              WebkitBackdropFilter: `blur(${layer.radius}px)`,
              maskImage: mask,
              WebkitMaskImage: mask,
            }}
          />
        );
      })}
    </div>
  );
}
