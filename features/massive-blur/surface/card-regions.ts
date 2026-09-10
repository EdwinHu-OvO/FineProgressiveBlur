export interface CardRegion {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
}

/** Clip the shared presentation layer, never the texture's sampling neighborhood. */
export function cardClipPath(regions: readonly CardRegion[]): string {
  if (!regions.length) return "inset(50%)";
  const paths = regions.map(({ x, y, width: w, height: h, radius }) => {
    const r = Math.min(radius, w / 2, h / 2),
      right = x + w,
      bottom = y + h;
    return `M${x + r},${y}H${right - r}A${r},${r} 0 0 1 ${right},${y + r}V${bottom - r}A${r},${r} 0 0 1 ${right - r},${bottom}H${x + r}A${r},${r} 0 0 1 ${x},${bottom - r}V${y + r}A${r},${r} 0 0 1 ${x + r},${y}Z`;
  });
  return `path("${paths.join(" ")}")`;
}
