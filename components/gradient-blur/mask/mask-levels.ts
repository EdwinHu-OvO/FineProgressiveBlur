/** Half-octave Gaussian scale space; final interpolation is linear in variance. */
export function maskBlurLevels(
  maxRadius: number,
  pixelRatio: number,
): number[] {
  const radius = Number.isFinite(maxRadius) ? Math.max(0, maxRadius) : 0;
  const levels = [0];
  let sigma = Math.min(0.5 / pixelRatio, radius);
  while (sigma > 0 && sigma < radius && levels.length < 31) {
    levels.push(sigma);
    sigma *= Math.SQRT2;
  }
  if (radius > 0) levels.push(radius);
  return levels;
}
