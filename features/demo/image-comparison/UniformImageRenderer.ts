import { createUniformAtlasLayout } from "@/components/gradient-blur/engine/atlas-layout";
import { CanvasTexture } from "@/components/gradient-blur/engine/canvas-texture";
import { GradientBlurRenderer } from "@/components/gradient-blur/engine/GradientBlurRenderer";
import type { GradientBlurAlgorithm } from "@/components/gradient-blur";

/** Uses the production Gaussian with one radius-adaptive band and no gradient. */
export class UniformImageRenderer {
  private readonly renderer: GradientBlurRenderer;
  private readonly source: CanvasTexture;
  private frame: {
    width: number;
    height: number;
    pixelRatio: number;
    sourceWidth: number;
    sourceHeight: number;
  } | null = null;
  private scale: number | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new GradientBlurRenderer(canvas);
    this.source = new CanvasTexture(this.renderer.gl);
  }

  setSource(
    canvas: HTMLCanvasElement,
    width: number,
    height: number,
    pixelRatio: number,
  ): void {
    this.renderer.resize(width, height, pixelRatio);
    this.source.upload(canvas);
    this.frame = {
      width,
      height,
      pixelRatio,
      sourceWidth: canvas.width,
      sourceHeight: canvas.height,
    };
    this.scale = null;
  }

  render(
    radius: number,
    algorithm: GradientBlurAlgorithm = "compact9",
  ): void {
    if (!this.frame) return;
    const { width, height, pixelRatio, sourceWidth, sourceHeight } = this.frame;
    const atlas = createUniformAtlasLayout(
      sourceWidth,
      sourceHeight,
      radius,
      pixelRatio,
    );
    if (this.scale !== atlas.bands[0].scale) {
      this.renderer.uploadGpuAtlas(
        this.source.framebuffer,
        { x: 0, y: 0, width: sourceWidth, height: sourceHeight },
        atlas,
        { direction: "top", maxRadius: radius },
        { width, height },
      );
      this.scale = atlas.bands[0].scale;
    }
    this.renderer.render({
      direction: "top",
      maxRadius: radius,
      uniformRadius: true,
      algorithm,
    });
  }

  dispose(): void {
    this.source.dispose();
    this.renderer.dispose();
  }
}
