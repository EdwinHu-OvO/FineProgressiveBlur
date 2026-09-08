// SPDX-License-Identifier: AGPL-3.0-only
// Extracted from Ringyuki/Rito @ 2733ea907762d424eb0c1cb1a8b069e262c3f60a.
// Local adaptations are documented in UPSTREAM.md.

import { computeInlineBoxRect, traceInlineRoundedRect } from "./inline-box";
import type { CanvasTextFragment } from "./types";

type InlineFragment = Pick<CanvasTextFragment, "rect" | "paint">;

export function drawInlineBackground(
  ctx: CanvasRenderingContext2D,
  fragment: InlineFragment,
): void {
  const color = fragment.paint.backgroundColor;
  if (!color) return;

  const rect = computeInlineBoxRect(fragment, ctx);
  const radius = fragment.paint.backgroundRadius ?? 0;
  ctx.save();
  try {
    ctx.fillStyle = color;
    if (radius > 0) {
      traceInlineRoundedRect(
        ctx,
        rect,
        radius,
        fragment.paint.boxStart !== false,
        fragment.paint.boxEnd !== false,
      );
      ctx.fill();
    } else {
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    }
  } finally {
    ctx.restore();
  }
}
