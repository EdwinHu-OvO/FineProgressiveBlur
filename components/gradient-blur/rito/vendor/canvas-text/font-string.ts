// SPDX-License-Identifier: AGPL-3.0-only
// Extracted from Ringyuki/Rito @ 2733ea907762d424eb0c1cb1a8b069e262c3f60a.
// Local adaptations are documented in UPSTREAM.md.

import type { CanvasFontShorthand } from "./types";

/** Serialize the structured font shorthand to the string Canvas expects. */
export function buildFontString(font: CanvasFontShorthand): string {
  const parts: string[] = [];
  if (font.style === "italic") parts.push("italic");
  if (font.weight !== 400) parts.push(String(font.weight));
  parts.push(`${String(font.sizePx)}px`);
  parts.push(font.family);
  return parts.join(" ");
}
