// SPDX-License-Identifier: AGPL-3.0-only
// Extracted from Ringyuki/Rito @ 2733ea907762d424eb0c1cb1a8b069e262c3f60a.
// Local adaptations are documented in UPSTREAM.md.

import type { Rect } from "./frame-types";

/** Merge adjacent rects on the same y into wider rects (one per line). */
export function mergeLineRects(rects: readonly Rect[]): Rect[] {
  if (rects.length === 0) return [];
  const merged: Rect[] = [];
  let current = rects[0];
  if (!current) return [];

  for (let i = 1; i < rects.length; i++) {
    const next = rects[i];
    if (!next) continue;
    if (
      next.y === current.y &&
      next.height === current.height &&
      next.x <= current.x + current.width + 1 &&
      next.x + next.width >= current.x - 1
    ) {
      const x = Math.min(current.x, next.x);
      const right = Math.max(current.x + current.width, next.x + next.width);
      current = { x, y: current.y, width: right - x, height: current.height };
    } else {
      merged.push(current);
      current = next;
    }
  }
  merged.push(current);
  return merged;
}
