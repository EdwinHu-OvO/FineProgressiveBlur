// SPDX-License-Identifier: AGPL-3.0-only
// Extracted from Ringyuki/Rito @ 2733ea907762d424eb0c1cb1a8b069e262c3f60a.
// Local adaptations are documented in UPSTREAM.md.

import type { CoreFrameCommand } from "../frame-types";

export type CanvasTextCommand = Extract<
  CoreFrameCommand,
  { readonly kind: "paintText" }
>;
export type CanvasRubyCommand = Extract<
  CoreFrameCommand,
  { readonly kind: "paintRuby" }
>;
export type CanvasTextFragment = Pick<
  CanvasTextCommand,
  "text" | "rect" | "paint" | "alignRight" | "vertical"
>;
export type CanvasRubyFragment = Pick<
  CanvasRubyCommand,
  "text" | "rect" | "paint" | "rubyAlign" | "vertical"
>;
export type CanvasRunPaint = CanvasTextCommand["paint"];
export type CanvasFontShorthand = CanvasRunPaint["font"];
export type CanvasTextShadow = NonNullable<
  CanvasRunPaint["textShadow"]
>[number];
export type CanvasInlineBorder = NonNullable<CanvasRunPaint["border"]>;
export type CanvasInlineBorderEdge = NonNullable<CanvasInlineBorder["top"]>;

export interface CanvasTextColorOverride {
  readonly foregroundColor: string;
  readonly backgroundColor: string;
}
