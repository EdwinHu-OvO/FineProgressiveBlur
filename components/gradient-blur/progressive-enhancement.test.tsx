import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GradientBlurProvider } from "./GradientBlurProvider";
import { GradientBlurOverlay } from "./GradientBlurOverlay";
import type { GradientBlurOverlayProps } from "./types";

describe("progressive enhancement server output", () => {
  it("renders CSS blur before JavaScript runs for either requested backend", () => {
    for (const captureBackend of ["auto", "html-in-canvas", "rito"] as const) {
      const html = renderToStaticMarkup(
        <GradientBlurProvider captureBackend={captureBackend}>
          <div>Content</div>
          <GradientBlurOverlay direction="top" />
          <GradientBlurOverlay direction="bottom" />
        </GradientBlurProvider>,
      );
      expect(html).toContain('data-capture-backend="css"');
      expect(html.match(/data-gradient-blur-fallback=""/g)).toHaveLength(2);
      expect(html.match(/data-gradient-blur-layer=/g)).toHaveLength(16);
      expect(html).toContain("backdrop-filter:blur(");
      expect(html).toContain(
        "display:var(--gradient-blur-fallback-display, block)",
      );
      expect(html).not.toContain("<canvas");
      expect(html.match(/data-blur-mode="gradient"/g)).toHaveLength(2);
      expect(html).toContain("height:100px");
    }
  });

  it("defaults to a full-size uniform blur with one unmasked CSS layer", () => {
    const html = renderToStaticMarkup(
      <GradientBlurProvider blurCurve={{ x1: 0.2, y1: 0, x2: 0.7, y2: 1 }}>
        <div>Content</div>
        <GradientBlurOverlay />
      </GradientBlurProvider>,
    );
    expect(html).toContain('data-blur-mode="uniform"');
    expect(html).toContain("height:100%");
    expect(html).toContain("backdrop-filter:blur(24px)");
    expect(html.match(/data-gradient-blur-fallback=""/g)).toHaveLength(1);
    expect(html).not.toMatch(
      /data-direction|mask-image|data-gradient-blur-layer/,
    );
  });

  it("does not create uniform CSS blur for zero or invalid radii", () => {
    for (const maxRadius of [0, -1, NaN, Infinity]) {
      const html = renderToStaticMarkup(
        <GradientBlurProvider>
          <div>Content</div>
          <GradientBlurOverlay maxRadius={maxRadius} />
        </GradientBlurProvider>,
      );
      expect(html).not.toContain("backdrop-filter");
    }
  });

  it("respects the explicit transparent fallback", () => {
    const html = renderToStaticMarkup(
      <GradientBlurProvider fallback="transparent">
        <div>Content</div>
        <GradientBlurOverlay direction="top" />
        <GradientBlurOverlay />
        <GradientBlurOverlay mask="/mask.svg" />
      </GradientBlurProvider>,
    );
    expect(html).not.toContain("data-gradient-blur-fallback");
    expect(html).not.toContain("backdrop-filter");
  });

  it("uses the supplied mask on the server and keeps it out of DOM attributes", () => {
    const html = renderToStaticMarkup(
      <GradientBlurProvider>
        <div>Content</div>
        <GradientBlurOverlay mask="/mask.svg" />
      </GradientBlurProvider>,
    );
    expect(html).toContain('data-blur-mode="mask"');
    expect(html).toContain('data-blur-fallback="masked-uniform"');
    expect(html).toContain("mask-mode:luminance");
    expect(html).not.toContain("linear-gradient");
    expect(html).not.toContain(' mask="');
    expect(html).not.toContain("data-direction");
    expect(html).toContain("height:100%");
  });

  it("positions partial non-directional overlays using style", () => {
    const html = renderToStaticMarkup(
      <GradientBlurProvider>
        <div>Content</div>
        <GradientBlurOverlay
          mask="/mask.svg"
          height={180}
          style={{ bottom: 0 }}
        />
      </GradientBlurProvider>,
    );
    expect(html).toContain("bottom:0");
    expect(html).toContain("height:180px");
    expect(html).not.toContain("top:0");
  });

  it("rejects simultaneous direction and mask in TypeScript and at runtime", () => {
    // @ts-expect-error A radius field has exactly one selector.
    const conflict: GradientBlurOverlayProps = {
      direction: "top",
      mask: "/mask.svg",
    };
    expect(() =>
      renderToStaticMarkup(
        <GradientBlurProvider>
          <div>Content</div>
          <GradientBlurOverlay {...conflict} />
        </GradientBlurProvider>,
      ),
    ).toThrow("direction and mask are mutually exclusive");
  });
});
