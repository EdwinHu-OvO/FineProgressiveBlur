import { AtlasTexture, type TextureCrop } from "../engine/atlas-texture";
import { GaussianBlur } from "../engine/gaussian-blur";
import type { GradientBlurProfile } from "../types";
import { MaskComposite } from "./MaskComposite";
import { createMaskAtlasLayout, type MaskAtlasLayout } from "./mask-atlas";
import { analyzeMask, type MaskGrid } from "./mask-regions";
import type { ResolvedBlurMask } from "./types";
import type { OverlayCaptureRegion } from "../engine/overlay-capture";

/** Shares capture/pyramid/compact9 passes; only planning and composition are 2D. */
export class MaskBlurRenderer {
  private readonly atlasTexture: AtlasTexture;
  private readonly gaussian: GaussianBlur;
  private readonly composite: MaskComposite;
  private readonly maxTextureSize: number;
  private layout: MaskAtlasLayout | null = null;
  private grid: MaskGrid | null = null;
  private geometryKey = "";
  private layoutKey = "";
  private view = { width: 1, height: 1 };
  private filtered: WebGLTexture | null = null;

  constructor(
    readonly gl: WebGL2RenderingContext,
    private readonly mask: ResolvedBlurMask,
  ) {
    this.composite = new MaskComposite(gl, mask);
    this.atlasTexture = new AtlasTexture(gl);
    this.gaussian = new GaussianBlur(gl);
    this.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
  }

  createLayout(
    width: number,
    height: number,
    profile: GradientBlurProfile,
    pixelRatio: number,
    capture?: OverlayCaptureRegion,
  ) {
    const geometryKey = `${width}:${height}`;
    const layoutKey = `${geometryKey}:${profile.maxRadius}:${pixelRatio}:${JSON.stringify(capture)}`;
    if (!this.grid || this.geometryKey !== geometryKey) {
      this.grid = analyzeMask(this.mask, width, height);
      this.geometryKey = geometryKey;
    }
    if (!this.layout || this.layoutKey !== layoutKey) {
      this.layout = createMaskAtlasLayout(
        this.grid,
        width,
        height,
        profile.maxRadius,
        pixelRatio,
        this.maxTextureSize,
        capture,
      );
      this.layoutKey = layoutKey;
    }
    return this.layout;
  }

  upload(
    source: WebGLFramebuffer,
    crop: TextureCrop,
    view: { width: number; height: number },
  ) {
    if (!this.layout)
      throw new Error("Plan the mask atlas before capturing it");
    this.gl.disable(this.gl.BLEND);
    // Mask coordinates are always top-left anchored, independent of placement.
    this.atlasTexture.copyFrom(source, crop, this.layout, "top");
    this.view = view;
    this.filtered = null;
  }

  render(profile: GradientBlurProfile, viewport: TextureCrop) {
    if (!this.layout) return;
    this.gl.disable(this.gl.BLEND);
    this.filtered ??= this.gaussian.apply(
      this.atlasTexture.texture,
      this.layout,
      { ...profile, direction: "top", uniformRadius: true },
      this.view,
    ).texture;
    this.composite.draw(this.filtered, this.layout, viewport);
  }

  dispose() {
    this.composite.dispose();
    this.atlasTexture.dispose();
    this.gaussian.dispose();
  }
}
