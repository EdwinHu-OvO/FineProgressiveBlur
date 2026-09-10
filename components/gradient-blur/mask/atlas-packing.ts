import type { AtlasBand } from "../engine/atlas-layout";

export function packMaskPatches(
  patches: readonly AtlasBand[],
  maxSize: number,
) {
  const area = patches.reduce(
    (sum, patch) => sum + (patch.width + 2) * (patch.height + 2),
    0,
  );
  const width = Math.min(
    maxSize,
    Math.max(
      Math.ceil(Math.sqrt(area)),
      ...patches.map((patch) => patch.width + 2),
    ),
  );
  let x = 0,
    y = 0,
    rowHeight = 0;
  for (const patch of [...patches].sort((a, b) => b.height - a.height)) {
    if (patch.width + 2 > maxSize || patch.height + 2 > maxSize)
      throw new Error("Blur mask capture exceeds the GPU texture size limit");
    if (x + patch.width + 2 > width) {
      x = 0;
      y += rowHeight;
      rowHeight = 0;
    }
    patch.x = x + 1;
    patch.y = y + 1;
    x += patch.width + 2;
    rowHeight = Math.max(rowHeight, patch.height + 2);
  }
  const height = y + rowHeight;
  if (height > maxSize || width * height > 16 * 1024 * 1024)
    throw new Error("Blur mask atlas exceeds the GPU allocation budget");
  return { width, height };
}
