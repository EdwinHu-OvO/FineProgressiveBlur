import type { GradientBlurProfile } from "../types";
import type { AtlasLayout } from "./atlas-layout";
import { GAUSSIAN_SHADER } from "./gaussian-shaders";
import { createGaussianKernel } from "./gaussian-kernel";
import { normalizeBezier } from "./profile";
import { RenderTarget } from "./render-target";
import { VERTEX_SHADER } from "./shaders";
import { createProgram, requireUniform } from "./webgl-utils";

export interface BlurRenderProfile extends GradientBlurProfile {
  uniformRadius?: boolean;
}

export interface GaussianResult {
  texture: WebGLTexture;
  verticalKernel?: ReturnType<typeof createGaussianKernel>;
}
const UNIFORM_NAMES = [
  "source",
  "atlasSize",
  "rect",
  "range",
  "viewSize",
  "axis",
  "sigma",
  "direction",
  "curve",
  "customCurve",
  "uniformRadius",
  "resampleVariance",
  "weights",
  "offsets",
  "pairs",
] as const;

export class GaussianBlur {
  private readonly program: WebGLProgram;
  private readonly vertexArray: WebGLVertexArrayObject;
  private readonly firstPass: RenderTarget;
  private readonly secondPass: RenderTarget;
  private readonly uniforms: Record<
    (typeof UNIFORM_NAMES)[number],
    WebGLUniformLocation
  >;
  private readonly kernels: Array<{
    sigma: number;
    variance: number;
    kernel: ReturnType<typeof createGaussianKernel>;
  }> = [];

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.program = createProgram(gl, VERTEX_SHADER, GAUSSIAN_SHADER);
    const vertexArray = gl.createVertexArray();
    if (!vertexArray) throw new Error("Unable to create Gaussian geometry");
    this.vertexArray = vertexArray;
    this.firstPass = new RenderTarget(gl);
    this.secondPass = new RenderTarget(gl);
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

  apply(
    source: WebGLTexture,
    atlas: AtlasLayout,
    profile: BlurRenderProfile,
    view: { width: number; height: number },
  ): GaussianResult {
    if (profile.maxRadius <= 0) return { texture: source };
    const gl = this.gl,
      u = this.uniforms;
    this.firstPass.resize(atlas.width, atlas.height);
    const fuseVertical =
      profile.uniformRadius &&
      atlas.bands.length === 1 &&
      atlas.bands[0].scale === 1;
    if (!fuseVertical) this.secondPass.resize(atlas.width, atlas.height);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vertexArray);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(u.source, 0);
    gl.uniform2f(u.atlasSize, atlas.width, atlas.height);
    gl.uniform2f(u.viewSize, view.width, view.height);
    gl.uniform1f(u.sigma, profile.maxRadius);
    gl.uniform1i(u.uniformRadius, profile.uniformRadius ? 1 : 0);
    gl.uniform1f(u.direction, profile.direction === "top" ? 0 : 1);
    const curve = normalizeBezier(
      profile.blurCurve ?? { x1: 0, y1: 0, x2: 1, y2: 1 },
    );
    gl.uniform4f(u.curve, curve.x1, curve.y1, curve.x2, curve.y2);
    gl.uniform1i(u.customCurve, profile.blurCurve ? 1 : 0);
    // A vertical radius field must filter Y first: the subsequent X taps all
    // share the destination row's sigma. X then Y mixes different row kernels
    // and stretches narrow strokes vertically. Constant blur allows either order.
    const axes = fuseVertical ? [0] : profile.uniformRadius ? [0, 1] : [1, 0];
    for (const [pass, axis] of axes.entries()) {
      const target = pass === 0 ? this.firstPass : this.secondPass;
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
      gl.invalidateFramebuffer(gl.FRAMEBUFFER, [gl.COLOR_ATTACHMENT0]);
      gl.bindTexture(
        gl.TEXTURE_2D,
        pass === 0 ? source : this.firstPass.texture,
      );
      gl.uniform2f(u.axis, axis === 0 ? 1 : 0, axis === 1 ? 1 : 0);
      for (const band of atlas.bands) {
        gl.viewport(band.x, band.y, band.width, band.height);
        gl.uniform4f(u.rect, band.x, band.y, band.width, band.height);
        gl.uniform2f(u.range, band.captureStart, band.captureEnd);
        const scaleX = band.width / atlas.sourceWidth;
        const scaleY =
          band.height /
          ((band.captureEnd - band.captureStart) * atlas.sourceHeight);
        gl.uniform2f(
          u.resampleVariance,
          Math.max(0, 1 - scaleX * scaleX) / 4,
          Math.max(0, 1 - scaleY * scaleY) / 4,
        );
        if (profile.uniformRadius) {
          const density =
            axis === 0
              ? band.width / view.width
              : band.height /
                ((band.captureEnd - band.captureStart) * view.height);
          const scale = axis === 0 ? scaleX : scaleY;
          const kernel = this.kernel(
            axis,
            profile.maxRadius * density,
            Math.max(0, 1 - scale * scale) / 4,
          );
          gl.uniform1fv(u.weights, kernel.weights);
          gl.uniform1fv(u.offsets, kernel.offsets);
          gl.uniform1i(u.pairs, kernel.pairs);
        } else {
          gl.uniform1i(u.pairs, 4);
        }
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return fuseVertical
      ? {
          texture: this.firstPass.texture,
          verticalKernel: this.kernel(
            1,
            (profile.maxRadius * atlas.sourceHeight) / view.height,
            0,
          ),
        }
      : { texture: this.secondPass.texture };
  }

  dispose(): void {
    this.firstPass.dispose();
    this.secondPass.dispose();
    this.gl.deleteVertexArray(this.vertexArray);
    this.gl.deleteProgram(this.program);
  }

  private kernel(axis: number, sigma: number, variance: number) {
    const cached = this.kernels[axis];
    if (cached?.sigma === sigma && cached.variance === variance)
      return cached.kernel;
    const kernel = createGaussianKernel(sigma, variance);
    this.kernels[axis] = {
      sigma,
      variance,
      kernel,
    };
    return kernel;
  }
}
