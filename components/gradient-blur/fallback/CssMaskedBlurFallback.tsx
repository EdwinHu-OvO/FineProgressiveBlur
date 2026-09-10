import type { BlurMask } from "../mask/types";

export function CssMaskedBlurFallback({
  mask,
  alphaUrl,
  maxRadius,
}: {
  mask: BlurMask;
  alphaUrl?: string;
  maxRadius: number;
}) {
  const options = typeof mask === "string" ? { source: mask } : mask;
  const url =
    alphaUrl ??
    (!options.invert && typeof options.source === "string"
      ? options.source
      : undefined);
  const radius = Number.isFinite(maxRadius) ? Math.max(0, maxRadius) : 0;
  if (!url || !radius) return null;
  return (
    <div
      data-gradient-blur-fallback=""
      data-blur-fallback="masked-uniform"
      style={{
        display: "var(--gradient-blur-fallback-display, block)",
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        backdropFilter: `blur(${radius}px)`,
        WebkitBackdropFilter: `blur(${radius}px)`,
        maskImage: `url(${JSON.stringify(url)})`,
        WebkitMaskImage: `url(${JSON.stringify(url)})`,
        maskMode: alphaUrl ? "alpha" : (options.channel ?? "luminance"),
        maskSize: "100% 100%",
        WebkitMaskSize: "100% 100%",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
      }}
    />
  );
}
