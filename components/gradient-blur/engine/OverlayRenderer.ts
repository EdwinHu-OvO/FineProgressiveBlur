import { MaskBlurRenderer } from "../mask/MaskBlurRenderer";
import type { ResolvedBlurMask } from "../mask/types";
import {
  createAtlasLayout,
  createUniformAtlasLayout,
  type AtlasLayout,
} from "./atlas-layout";
import type { TextureCrop } from "./atlas-texture";
import { GradientBlurRenderer } from "./GradientBlurRenderer";
import type { OverlayCaptureRegion } from "./overlay-capture";
import { renderProfile, type OverlayRenderProfile } from "./overlay-mode";

/** Keeps capture backends independent of the overlay's radius field. */
export class OverlayRenderer {
  private readonly gradient?: GradientBlurRenderer;
  private readonly variable?: MaskBlurRenderer;
  private sampleRegion?: TextureCrop;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    readonly gl: WebGL2RenderingContext,
    mask?: ResolvedBlurMask,
  ) {
    if (mask) this.variable = new MaskBlurRenderer(gl, mask);
    else this.gradient = new GradientBlurRenderer(canvas, gl);
  }

  createLayout(
    width: number,
    height: number,
    profile: OverlayRenderProfile,
    pixelRatio: number,
    capture?: OverlayCaptureRegion,
  ) {
    if (this.variable)
      return this.variable.createLayout(
        width,
        height,
        renderProfile(profile),
        pixelRatio,
        capture,
      );
    this.sampleRegion = undefined;
    if (profile.direction !== undefined)
      return createAtlasLayout(
        width,
        height,
        profile.maxRadius,
        pixelRatio,
        profile.blurCurve,
      );
    if (capture)
      this.sampleRegion = {
        x: capture.offsetX / capture.width,
        y: capture.offsetY / capture.height,
        width: width / capture.width,
        height: height / capture.height,
      };
    return createUniformAtlasLayout(
      capture?.width ?? width,
      capture?.height ?? height,
      profile.maxRadius,
      pixelRatio,
    );
  }

  uploadGpuAtlas(
    source: WebGLFramebuffer,
    crop: TextureCrop,
    atlas: AtlasLayout,
    profile: OverlayRenderProfile,
    view: { width: number; height: number },
  ) {
    if (this.variable) this.variable.upload(source, crop, view);
    else
      this.gradient!.uploadGpuAtlas(
        source,
        crop,
        atlas,
        renderProfile(profile),
        view,
        this.sampleRegion,
      );
  }

  render(profile: OverlayRenderProfile, viewport?: TextureCrop) {
    if (this.variable)
      this.variable.render(
        renderProfile(profile),
        viewport ?? {
          x: 0,
          y: 0,
          width: this.canvas.width,
          height: this.canvas.height,
        },
      );
    else
      this.gradient!.render(
        {
          ...renderProfile(profile),
          uniformRadius: profile.direction === undefined,
        },
        viewport,
      );
  }

  dispose() {
    this.variable?.dispose();
    this.gradient?.dispose();
  }
}
