import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GradientBlurProvider } from "./GradientBlurProvider";
import { GradientBlurOverlay } from "./GradientBlurOverlay";

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
    }
  });

  it("respects the explicit transparent fallback", () => {
    const html = renderToStaticMarkup(
      <GradientBlurProvider fallback="transparent">
        <div>Content</div>
        <GradientBlurOverlay direction="top" />
      </GradientBlurProvider>,
    );
    expect(html).not.toContain("data-gradient-blur-fallback");
    expect(html).not.toContain("backdrop-filter");
  });
});
