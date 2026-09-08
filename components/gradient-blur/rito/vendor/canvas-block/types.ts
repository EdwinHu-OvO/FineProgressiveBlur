// SPDX-License-Identifier: AGPL-3.0-only
// Extracted from Ringyuki/Rito @ 2733ea907762d424eb0c1cb1a8b069e262c3f60a.
// Local adaptations are documented in UPSTREAM.md.

import type { CoreFrameCommand } from "../frame-types";

export type CanvasBlockCommand = Extract<
  CoreFrameCommand,
  { readonly kind: "paintBlock" }
>;
export type CanvasBlockRect = CanvasBlockCommand["rect"];
export type CanvasBlockPaint = CanvasBlockCommand["paint"];
export type CanvasBlockBackgroundPaint = NonNullable<
  CanvasBlockPaint["background"]
>;
export type CanvasBlockBorderPaint = NonNullable<CanvasBlockPaint["border"]>;
export type CanvasBlockBorderBox = NonNullable<CanvasBlockCommand["borderBox"]>;
export type CanvasBlockBoxShadow = NonNullable<
  CanvasBlockPaint["boxShadow"]
>[number];
export type CanvasBlockBorderPaintEdge = NonNullable<
  CanvasBlockBorderPaint["top"]
>;

export interface CanvasBlockResolvedRadius {
  readonly rx: CanvasBlockRect["width"];
  readonly ry: CanvasBlockRect["height"];
  /** Per-corner circular radii (CSS order) when the corners disagree. */
  readonly corners?: readonly [number, number, number, number];
}

/** A decoded raster the block painter can draw and measure. */
export type CanvasBlockDrawableImage = ImageBitmap | HTMLImageElement;

export type CanvasBlockImageResolver = (
  src: NonNullable<CanvasBlockBackgroundPaint["image"]>,
) => CanvasBlockDrawableImage | undefined;
