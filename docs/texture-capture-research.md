# Texture capture decision

## Decision

The default path uses the WICG HTML-in-Canvas API when the browser exposes the
same-canvas WebGL upload methods. The Provider owns one `canvas[layoutsubtree]`
and one WebGL context; its slotted DOM remains the live React DOM. The browser
captures that DOM directly into a GPU texture, and the atlas is generated with
`blitFramebuffer`. No `cloneNode`, CPU pixel readback, or 2D staging canvas is
used on this path.

The compatible path uses `@zumer/snapdom`. It serializes the visible scroller and uses
`toCanvas({ crop })` to rasterize only the top or bottom strip. SnapDOM 2.24.15
skips the root scroll translation with `clip`, so viewport clipping must happen
at export rather than capture. This preserves root and nested scroll offsets.

## Options considered

| Option         | Finding                                                                                                                                                                                                                                      | Decision                                             |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| HTML-in-Canvas | Native DOM layout and `texElementImage2D`/`texElementSubImage2D`; currently experimental and browser-gated. Current Chromium rejects an `ElementImage` captured by a different Canvas, so the source and WebGL consumer must share a Canvas. | Use as the primary path behind capability detection. |
| Canvas UI      | The reviewed WebGL renderer rasterizes HTML through `drawElementImage` into a 2D canvas before texture upload. It is a useful component wrapper, but retains the copy this project is trying to remove.                                      | Do not add the dependency.                           |
| SnapDOM        | Small ESM package with explicit clip coordinates and reusable canvas export. It serializes DOM to SVG/`foreignObject`, so it still rasterizes, and its clipping/export API fits a bounded fallback.                                          | Use for fallback and explicit adapter selection.     |

Sources: [HTML-in-Canvas proposal](https://github.com/WICG/html-in-canvas),
[WebGL example](https://github.com/WICG/html-in-canvas/blob/main/Examples/webGL.html),
[Canvas UI rendering guide](https://canvasui.dev/docs/rendering),
[SnapDOM documentation](https://snapdom.dev/docs/).

The native API does not promise a driver-level zero-copy implementation. The
implementation guarantee here is that application JavaScript avoids DOM cloning,
pixel readback and an intermediate 2D texture upload; the browser and driver
remain responsible for their internal compositing work.

Runtime timings measure JavaScript call submission. They do not wait for GPU
completion and should not be read as end-to-end GPU timings or a zero-copy proof.

## Validation (2026-09-07)

- Typecheck, ESLint and 20 Vitest tests passed. Boundary tests cover export
  cropping, root bleed, cancellation, scrollend deduplication and radius/DPR LODs.
- Headless Edge 152.0.4191.66, with and without `CanvasDrawElement`, selected the
  native and SnapDOM backends respectively. At DPR 2, scrolling, resizing,
  toggling overlays and preserving the same React DOM/button state passed.
- Forcing native WebGL context loss restored the SnapDOM path and retained DOM
  identity and interaction state.
- Instrumenting 32 native uploads counted zero Provider DOM clones, zero 2D
  context requests and zero WebGL pixel readbacks, including initialization.
  This checks the application's path, not the browser's internal GPU copies.
- The browser checks used SwiftShader; the small JS submission timings are not
  hardware GPU benchmarks. The newer `texElementSubImage2D` signature still needs
  verification on a browser build that implements it.

## Scroll and sampling correction

This section records the earlier disk-kernel implementation. The current Gaussian
pipeline deliberately filters in encoded sRGB to match CSS, and supports more
resolution levels. See [CSS blur alignment](css-blur-alignment.md) for the current
kernel, color-space contract, and measurements. Capture scheduling below is unchanged.

- Default to live capture. Scroll invalidates snapshots immediately; stale async
  results are cancelled and never presented. CSS blur supplies current backdrop
  pixels while waiting. Explicit scrollend/static modes also hide stale textures.
- Native live overlays rebuild from the same scene paint, including scroll paints
  between animation ticks. Both backends build quarter-scale bands with two 2× GPU reductions in
  linear light. This avoids the aliasing and LOD-dependent brightness of Canvas
  2D downsampling. SnapDOM uploads a full edge strip once and reuses that GPU
  texture on radius changes; its CPU upload size is the full strip, not the atlas.
- LOD boundaries follow local radius in source pixels (8 for quarter scale, 4 for
  half scale). The full strip retains the configured DPR; zero radius uses one
  full-resolution band. UV remapping preserves texel centers without stretching
  the crop. Radius changes rebuild the atlas, reusing the captured strip texture.
- An isolated browser fixture with 1px stripes and uniquely colored rows passed
  exact pixel comparisons for both backends at DPR 1 and 2, scroll offsets 0, 67,
  230 and 613, and radius 28 → 1 → 0. A deliberately delayed 300ms snapshot was
  hidden during scrolling and the final frame matched the current source exactly.
- A high-frequency 1:3 black/white stripe fixture now yields the same quarter-LOD
  value (225 sRGB) in both backends. A direct 4× reduction lost the black lines;
  Canvas 2D staging preserved them but averaged in encoded sRGB (192), producing
  inconsistent brightness between LODs. The shared GPU path removes both errors.

Capture scheduling and GPU presentation now have separate owners, replacing the
400-line renderer hook. `native-surface.ts` remains 210 lines because it owns one
Provider lifecycle, with paint ordering and cleanup kept together; no further
split is needed for this correction.

## Backend selection and layered CSS fallback

The demo now exposes automatic, explicit HTML-in-Canvas, SnapDOM and CSS modes.
Switches preserve the same source DOM, scroll offset and interaction state.
Explicit native failure uses the configured visual fallback; automatic native
failure continues to SnapDOM. Unsupported native selection is disabled in the UI.

CSS mode and the CSS fallback share eight sibling backdrop-filter layers. Radii
double from `Rmax / 128` to `Rmax`; overlapping masks progress from the clear
content edge to the blurred outer edge. The container has no mask or opacity
animation, preserving access to the backdrop under the
[backdrop root rules](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/backdrop-filter).
Zero radius omits all filter layers. CSS mode does not capture DOM or allocate
Canvas/WebGL contexts, and its diagnostics report layers instead of GPU timings.

- Seven new unit cases cover exponential radii, mask overlap, mirrored directions
  and zero/invalid radii, bringing the suite to 27 tests.
- Edge 152 checks passed with and without the native feature enabled: repeated
  backend switches, native context-loss fallback, retained DOM/state/scroll and
  a 390px viewport without horizontal overflow. No page errors were reported.
- A CSS stripe fixture measured outer-edge contrast below 2 intensity levels and
  inner-edge contrast above 108 in both directions. Radius zero matched the
  unobscured source exactly. Instrumentation recorded zero 2D or WebGL context
  requests even with the native feature enabled.

## Live content updates without a fixed frame-rate cap

Removed the capture interval, live-frame timestamp gate and native requestPaint
timer loop. The legacy `liveFramesPerSecond` prop is ignored. Browser refresh,
capture completion and GPU query completion determine throughput; a single
in-flight task plus the newest pending frame bounds work without a timer cap.

Native capture follows the browser's `paint.changedElements` snapshot notification
and ignores empty paint requests unless presentation needs updating. This checks
browser-recorded drawable content, rather than using resize or DOM mutation as
a proxy. See the [HTML-in-Canvas paint contract](https://github.com/WICG/html-in-canvas#3-the-paint-event).

Raster candidates are uploaded into separate GPU storage and compared against
the last accepted texture with `texelFetch` on every RGBA texel. Equal fragments
are discarded; an asynchronous
[`ANY_SAMPLES_PASSED` query](https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext/beginQuery)
reports whether any pixel differed. Matching pixels skip atlas generation and
blur draws. Accepted and candidate textures remain separate until the query
finishes, so cancellation cannot overwrite the displayed frame. No application
pixel readback or CPU hashing is used. This adds a candidate texture, an R8 query
target and query latency; it does not remove SnapDOM serialization or upload
costs. Browser/driver internal copies are not measured.

Source mutations, inputs, resource loads, font/style changes and active
animation/video frames nominate SnapDOM captures. These events do not decide
pixel equality. Imperative nested Canvas draws or CSSOM changes still require
the producer to call `refresh()`; a direct Canvas source has a frame feed.

- 34 unit tests cover immediate scheduling, 4ms-spaced frames, newest-frame
  backpressure, comparison cancellation and accepted texture ownership.
- An actual WebGL check submitted 10 identical frames with no extra blur draw,
  detected a one-channel, one-level change at a single pixel of the same Canvas,
  and skipped a different Canvas object holding the same pixels. Revalidating
  unchanged content preserved the visible output. No `readPixels` call occurred.
- Both native and SnapDOM paths remained idle with zero blur draws. A content
  color change triggered rendering without resize or scroll. An empty native
  paint request performed zero uploads/draws; a nonvisual DOM attribute change
  in SnapDOM ran the pixel comparison but no blur draw.
- Even with the deprecated rate prop set to 1, a 300ms native color animation
  delivered 19 content uploads. The direct Canvas feed also stayed at one blur
  draw through repeated identical frames, then drew exactly once after one
  pixel changed. These are scheduling checks on SwiftShader, not GPU benchmarks.
- Scroll and radius pixel comparisons still passed at DPR 1/2 and offsets
  0/67/230/613, including a cancelled 300ms capture. All compared pixels matched.

`RasterOverlay` remains 201 lines as one presentation lifecycle. Texture
comparison/ownership and metrics reporting now live in separate focused modules.
