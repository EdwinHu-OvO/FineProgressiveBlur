export function smootherStep(value: number): number {
  const clamped = Math.min(1, Math.max(0, value));
  return clamped * clamped * clamped * (clamped * (clamped * 6 - 15) + 10);
}

export function blurProfile(edgeProgress: number): number {
  return 1 - smootherStep(edgeProgress);
}

export function blurRadiusAt(edgeProgress: number, maxRadius: number): number {
  return Math.max(0, maxRadius) * blurProfile(edgeProgress);
}
