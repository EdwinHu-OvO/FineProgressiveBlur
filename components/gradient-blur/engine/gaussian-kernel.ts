export const GAUSSIAN_PAIRS = 6;

/** Normalized adjacent-tap pairs for hardware bilinear sampling. */
export function createGaussianKernel(
  sigma: number,
  resampleVariance = 0,
  maxPairs = GAUSSIAN_PAIRS,
) {
  const variance = Math.max(0, sigma * sigma - resampleVariance);
  const weights = new Float32Array(GAUSSIAN_PAIRS + 1);
  const offsets = new Float32Array(GAUSSIAN_PAIRS);
  weights[0] = 1;
  if (variance < 0.01) return { weights, offsets, pairs: 0 };
  const pairs = Math.min(maxPairs, Math.ceil(Math.ceil(3 * sigma) / 2));
  let total = 1;
  for (let pair = 0; pair < pairs; pair++) {
    const first = pair * 2 + 1;
    const a = Math.exp((-0.5 * first * first) / variance);
    const b = Math.exp((-0.5 * (first + 1) ** 2) / variance);
    const weight = a + b;
    weights[pair + 1] = weight;
    offsets[pair] = first + b / weight;
    total += 2 * weight;
  }
  for (let index = 0; index <= pairs; index++) weights[index] /= total;
  return { weights, offsets, pairs };
}
