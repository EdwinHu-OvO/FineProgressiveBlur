export function CssUniformBlurFallback({ maxRadius }: { maxRadius: number }) {
  const radius = Number.isFinite(maxRadius) ? Math.max(0, maxRadius) : 0;
  if (!radius) return null;
  return (
    <div
      data-gradient-blur-fallback=""
      data-blur-fallback="uniform"
      style={{
        display: "var(--gradient-blur-fallback-display, block)",
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        backdropFilter: `blur(${radius}px)`,
        WebkitBackdropFilter: `blur(${radius}px)`,
      }}
    />
  );
}
