// SPDX-License-Identifier: AGPL-3.0-only
// Extracted from Ringyuki/Rito @ 2733ea907762d424eb0c1cb1a8b069e262c3f60a.
// Local adaptations are documented in UPSTREAM.md.

export function canvasSpacingValue(value: number | undefined): string {
  return value === undefined ? "0px" : `${String(value)}px`;
}
