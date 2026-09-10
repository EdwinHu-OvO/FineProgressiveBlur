import type { GradientBlurDirection } from "../types";
import type { AtlasLayout } from "./atlas-layout";
import { EncodedCopy } from "./encoded-copy";
import { RenderTarget } from "./render-target";
import { PyramidReduction } from "./pyramid-reduction";

export interface TextureCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Packs an sRGB-encoded pyramid into bands; reductions are shared by all bands. */
export class AtlasTexture {
  private readonly target: RenderTarget;
  private readonly copy: EncodedCopy;
  private reduction: PyramidReduction | null = null;
  private readonly reductions: RenderTarget[] = [];

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.target = new RenderTarget(gl);
    this.copy = new EncodedCopy(gl);
  }

  get texture(): WebGLTexture {
    return this.target.texture;
  }

  copyFrom(
    source: WebGLFramebuffer,
    crop: TextureCrop,
    layout: AtlasLayout,
    direction: GradientBlurDirection,
  ): void {
    const gl = this.gl;
    this.target.resize(layout.width, layout.height);
    const region = {
      x: Math.round(crop.x),
      y: Math.round(crop.y),
      width: Math.round(crop.x + crop.width) - Math.round(crop.x),
      height: Math.round(crop.y + crop.height) - Math.round(crop.y),
    };
    const bands = [...layout.bands].sort((a, b) => b.scale - a.scale);
    // The zero/small-radius path needs no downsample storage or extra copies.
    if (
      bands.length === 1 &&
      bands[0].scale === 1 &&
      bands[0].captureStart === 0 &&
      bands[0].captureEnd === 1 &&
      (bands[0].captureLeft ?? 0) === 0 &&
      (bands[0].captureRight ?? 1) === 1
    ) {
      this.copy.draw(source, region, this.target.framebuffer, bands[0]);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return;
    }
    let input = source;
    let width = region.width,
      height = region.height;
    const firstLevel =
      bands[0].scale === 1 || region.width % 2 || region.height % 2 ? 0 : 1;
    const lastLevel = Math.round(-Math.log2(bands.at(-1)!.scale));
    for (let level = firstLevel; level <= lastLevel; level++) {
      const scale = 2 ** -level;
      const reducedWidth = Math.max(1, Math.ceil(region.width * scale));
      const reducedHeight = Math.max(1, Math.ceil(region.height * scale));
      const target = (this.reductions[level] ??= new RenderTarget(gl));
      target.resize(reducedWidth, reducedHeight);
      if (level === firstLevel) {
        this.copy.draw(source, region, target.framebuffer, {
          x: 0,
          y: 0,
          width: reducedWidth,
          height: reducedHeight,
        });
      } else if (width % 2 || height % 2) {
        this.reduction ??= new PyramidReduction(gl);
        this.reduction.draw(this.reductions[level - 1], target);
      } else {
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, input);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, target.framebuffer);
        gl.blitFramebuffer(
          0,
          0,
          width,
          height,
          0,
          0,
          reducedWidth,
          reducedHeight,
          gl.COLOR_BUFFER_BIT,
          gl.LINEAR,
        );
      }
      input = target.framebuffer;
      width = reducedWidth;
      height = reducedHeight;
      for (const band of bands.filter((entry) => entry.scale === scale)) {
        const start =
          direction === "top" ? band.captureStart : 1 - band.captureEnd;
        const end =
          direction === "top" ? band.captureEnd : 1 - band.captureStart;
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, input);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.target.framebuffer);
        gl.blitFramebuffer(
          Math.round((band.captureLeft ?? 0) * width),
          Math.round(start * height),
          Math.round((band.captureRight ?? 1) * width),
          Math.round(end * height),
          band.x,
          band.y,
          band.x + band.width,
          band.y + band.height,
          gl.COLOR_BUFFER_BIT,
          gl.LINEAR,
        );
      }
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  dispose(): void {
    this.target.dispose();
    this.copy.dispose();
    this.reduction?.dispose();
    this.reductions.forEach((target) => target.dispose());
  }
}
