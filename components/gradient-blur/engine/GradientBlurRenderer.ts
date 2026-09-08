import { MAX_ATLAS_BANDS, type AtlasLayout } from "./atlas-layout";
import { AtlasTexture, type TextureCrop } from "./atlas-texture";
import {
  GaussianBlur,
  type BlurRenderProfile,
  type GaussianResult,
} from "./gaussian-blur";
import { FRAGMENT_SHADER, VERTEX_SHADER } from "./shaders";
import { createProgram, requireUniform } from "./webgl-utils";
import type { GradientBlurProfile } from "../types";

const UNIFORM_NAMES = [
  "atlas",
  "atlasSize",
  "direction",
  "bandCount",
  "bandEnds",
  "bandBlendEnds",
  "bandRects",
  "bandRanges",
  "blurY",
  "pairs",
  "weights",
  "offsets",
] as const;

export class GradientBlurRenderer {
  readonly gl: WebGL2RenderingContext;
  private readonly program: WebGLProgram;
  private readonly vertexArray: WebGLVertexArrayObject;
  private readonly atlasTexture: AtlasTexture;
  private readonly gaussian: GaussianBlur;
  private readonly uniforms: Record<
    (typeof UNIFORM_NAMES)[number],
    WebGLUniformLocation
  >;
  private readonly bandEnds = new Float32Array(MAX_ATLAS_BANDS);
  private readonly bandBlendEnds = new Float32Array(MAX_ATLAS_BANDS);
  private readonly bandRects = new Float32Array(MAX_ATLAS_BANDS * 4);
  private readonly bandRanges = new Float32Array(MAX_ATLAS_BANDS * 2);
  private atlas: AtlasLayout | null = null;
  private viewSize = { width: 1, height: 1 };
  private filtered: GaussianResult | null = null;
  private filteredProfile = "";

  constructor(
    private readonly canvas: HTMLCanvasElement,
    sharedContext?: WebGL2RenderingContext,
  ) {
    const gl =
      sharedContext ??
      canvas.getContext("webgl2", {
        alpha: true,
        antialias: false,
        depth: false,
        desynchronized: true,
        powerPreference: "low-power",
        premultipliedAlpha: true,
        preserveDrawingBuffer: false,
        stencil: false,
      });
    if (!gl) throw new Error("WebGL2 is unavailable");
    this.gl = gl;
    this.program = createProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER);
    const vertexArray = gl.createVertexArray();
    if (!vertexArray) throw new Error("Unable to create blur geometry");
    this.vertexArray = vertexArray;
    this.atlasTexture = new AtlasTexture(gl);
    this.gaussian = new GaussianBlur(gl);
    this.uniforms = Object.fromEntries(
      UNIFORM_NAMES.map((name) => [
        name,
        requireUniform(
          gl,
          this.program,
          `u${name[0].toUpperCase()}${name.slice(1)}`,
        ),
      ]),
    ) as typeof this.uniforms;
  }

  resize(width: number, height: number, pixelRatio: number): void {
    const bufferWidth = Math.max(1, Math.round(width * pixelRatio));
    const bufferHeight = Math.max(1, Math.round(height * pixelRatio));
    if (this.canvas.width !== bufferWidth) this.canvas.width = bufferWidth;
    if (this.canvas.height !== bufferHeight) this.canvas.height = bufferHeight;
    this.viewSize = { width, height };
  }

  uploadGpuAtlas(
    source: WebGLFramebuffer,
    crop: TextureCrop,
    atlas: AtlasLayout,
    profile: GradientBlurProfile,
    viewSize: { width: number; height: number },
  ): void {
    this.gl.disable(this.gl.BLEND);
    this.atlasTexture.copyFrom(source, crop, atlas, profile.direction);
    this.atlas = atlas;
    this.viewSize = viewSize;
    this.filtered = null;
    atlas.bands.forEach((band, index) => {
      this.bandEnds[index] = band.coreEnd;
      this.bandBlendEnds[index] = band.blendEnd;
      this.bandRects.set([band.x, band.y, band.width, band.height], index * 4);
      this.bandRanges.set([band.captureStart, band.captureEnd], index * 2);
    });
  }

  render(profile: BlurRenderProfile, viewport?: TextureCrop): void {
    if (!this.atlas) return;
    const gl = this.gl,
      u = this.uniforms;
    const key = `${profile.direction}:${profile.maxRadius}:${Boolean(profile.uniformRadius)}:${profile.algorithm ?? "compact9"}`;
    gl.disable(gl.BLEND);
    if (!this.filtered || key !== this.filteredProfile) {
      this.filtered = this.gaussian.apply(
        this.atlasTexture.texture,
        this.atlas,
        profile,
        this.viewSize,
      );
      this.filteredProfile = key;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(
      viewport?.x ?? 0,
      viewport?.y ?? 0,
      viewport?.width ?? this.canvas.width,
      viewport?.height ?? this.canvas.height,
    );
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vertexArray);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.filtered.texture);
    gl.uniform1i(u.atlas, 0);
    gl.uniform2f(u.atlasSize, this.atlas.width, this.atlas.height);
    gl.uniform1f(u.direction, profile.direction === "top" ? 0 : 1);
    gl.uniform1i(u.bandCount, this.atlas.bands.length);
    gl.uniform1fv(u.bandEnds, this.bandEnds);
    gl.uniform1fv(u.bandBlendEnds, this.bandBlendEnds);
    gl.uniform4fv(u.bandRects, this.bandRects);
    gl.uniform2fv(u.bandRanges, this.bandRanges);
    gl.uniform1i(u.blurY, this.filtered.verticalKernel ? 1 : 0);
    if (this.filtered.verticalKernel) {
      const kernel = this.filtered.verticalKernel;
      gl.uniform1i(u.pairs, kernel.pairs);
      gl.uniform1fv(u.weights, kernel.weights);
      gl.uniform1fv(u.offsets, kernel.offsets);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose(): void {
    this.atlasTexture.dispose();
    this.gaussian.dispose();
    this.gl.deleteVertexArray(this.vertexArray);
    this.gl.deleteProgram(this.program);
  }
}
