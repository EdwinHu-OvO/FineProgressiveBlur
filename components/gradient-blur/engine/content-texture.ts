import { CanvasTexture } from "./canvas-texture";
import { TextureComparison } from "./texture-comparison";

/** A pending upload never overwrites the last accepted texture while its query runs. */
export class ContentTexture {
  private accepted: CanvasTexture;
  private candidate: CanvasTexture;
  private readonly comparison: TextureComparison;
  private width = 0;
  private height = 0;

  constructor(gl: WebGL2RenderingContext) {
    this.accepted = new CanvasTexture(gl);
    this.candidate = new CanvasTexture(gl);
    this.comparison = new TextureComparison(gl);
  }

  get framebuffer(): WebGLFramebuffer {
    return this.accepted.framebuffer;
  }

  async update(
    canvas: HTMLCanvasElement | OffscreenCanvas,
    signal: AbortSignal,
  ): Promise<{ changed: boolean; uploadMs: number }> {
    signal.throwIfAborted();
    const startedAt = performance.now();
    this.candidate.upload(canvas);
    const uploadMs = performance.now() - startedAt;
    const { width, height } = canvas;
    const changed =
      width !== this.width ||
      height !== this.height ||
      (await this.comparison.differs(
        this.accepted.texture,
        this.candidate.texture,
        width,
        height,
        signal,
      ));
    signal.throwIfAborted();
    if (changed) {
      [this.accepted, this.candidate] = [this.candidate, this.accepted];
      this.width = width;
      this.height = height;
    }
    return { changed, uploadMs };
  }

  dispose(): void {
    this.comparison.dispose();
    this.accepted.dispose();
    this.candidate.dispose();
  }
}
