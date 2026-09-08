# Rito extraction

Source: [Ringyuki/Rito](https://github.com/Ringyuki/Rito/tree/2733ea907762d424eb0c1cb1a8b069e262c3f60a)
at `2733ea907762d424eb0c1cb1a8b069e262c3f60a`, retrieved 2026-09-07.
License: **AGPL-3.0-only**, as declared by both upstream packages. The complete
upstream license is preserved in [LICENSE](./LICENSE). This extraction does not
relicense upstream code under the surrounding project's terms.

## Extracted code

- `canvas-block/*`, `canvas-text/*`, `canvas-path.ts` come from
  `packages/rito/src/bindings/browser/`.
- `frame-types.ts` comes from
  `packages/rito-core-wasm/src/types/frame-command.ts`; the `RitoCoreWasm` type
  prefix was removed and an alias replaces the WASM package import.
- `selection-rects.ts` extracts `mergeLineRects` from
  `packages/kit/src/interaction/selection/range.ts`.
- The adjacent `../paint-commands.ts` adapts the browser frame command replayer.
  It uses already resolved DOM colors, throws on invalid frames instead of
  silently displaying partial content, and accepts a caller-owned canvas.
- `../interaction-painter.ts` adapts the layer ordering and rectangular fill/
  border loop from `packages/kit/src/painter/overlay-painter.ts` to WebGL.

## Local adaptations

The browser DOM supplies layout and computed styles. EPUB parsing, CSS cascade,
pagination, Rust/WASM, book navigation, and theme color substitution are omitted.
The text painter retains ZWJ/ZWNJ so joined emoji and contextual scripts are not
split. Selection rectangle merging additionally requires touching fragments
with matching heights, so it does not highlight the whitespace between columns.
Upstream Canvas text, ruby, border and shadow algorithms remain grouped
as upstream files, including files over 200 lines, to make future comparisons
and upstream fixes reviewable. These files are compiled and linted normally.

The interaction bridge uses the original React DOM for real pointer events,
native selection/copy, keyboard controls and accessibility. It projects native
selection and focus geometry into the Canvas; it does not create a second
semantic tree or synthesize clicks, which would break native default actions.
