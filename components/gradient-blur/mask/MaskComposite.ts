import type { TextureCrop } from "../engine/atlas-texture";
import { VERTEX_SHADER } from "../engine/shaders";
import { createProgram, requireUniform } from "../engine/webgl-utils";
import type { MaskAtlasLayout } from "./mask-atlas";
import { MASK_COMPOSITE_SHADER } from "./mask-shader";
import type { ResolvedBlurMask } from "./types";

const NAMES = [
  "Atlas",
  "Mask",
  "AtlasSize",
  "Rect",
  "Range",
  "Core",
  "MaskRegion",
  "Levels",
  "Radius",
] as const;

export class MaskComposite {
  private readonly program: WebGLProgram;
  private readonly geometry: WebGLVertexArrayObject;
  private readonly texture: WebGLTexture;
  private readonly uniforms: Record<
    (typeof NAMES)[number],
    WebGLUniformLocation
  >;

  constructor(
    private readonly gl: WebGL2RenderingContext,
    mask: ResolvedBlurMask,
  ) {
    const limit = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    if (mask.width > limit || mask.height > limit)
      throw new Error("Blur mask exceeds the GPU texture size limit");
    this.program = createProgram(gl, VERTEX_SHADER, MASK_COMPOSITE_SHADER);
    const geometry = gl.createVertexArray(),
      texture = gl.createTexture();
    if (!geometry || !texture)
      throw new Error("Unable to create mask composite resources");
    this.geometry = geometry;
    this.texture = texture;
    this.uniforms = Object.fromEntries(
      NAMES.map((name) => [name, requireUniform(gl, this.program, `u${name}`)]),
    ) as typeof this.uniforms;
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const alignment = gl.getParameter(gl.UNPACK_ALIGNMENT) as number;
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R8,
      mask.width,
      mask.height,
      0,
      gl.RED,
      gl.UNSIGNED_BYTE,
      mask.values as Uint8Array<ArrayBuffer>,
    );
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, alignment);
    gl.activeTexture(gl.TEXTURE0);
  }

  draw(
    texture: WebGLTexture,
    atlas: MaskAtlasLayout,
    viewport: TextureCrop,
  ): void {
    const gl = this.gl,
      u = this.uniforms;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.geometry);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(u.Atlas, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(u.Mask, 1);
    gl.uniform2f(u.AtlasSize, atlas.width, atlas.height);
    gl.uniform1f(u.Radius, atlas.levels.at(-1)!);
    const mask = atlas.maskRegion;
    gl.uniform4f(
      u.MaskRegion,
      mask.x / atlas.sourceWidth,
      mask.y / atlas.sourceHeight,
      mask.width / atlas.sourceWidth,
      mask.height / atlas.sourceHeight,
    );
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    for (const patch of atlas.bands) {
      const { core, level } = patch;
      const left = Math.round((core.x / mask.width) * viewport.width);
      const right = Math.round(
        ((core.x + core.width) / mask.width) * viewport.width,
      );
      const top = Math.round((core.y / mask.height) * viewport.height);
      const bottom = Math.round(
        ((core.y + core.height) / mask.height) * viewport.height,
      );
      gl.viewport(
        viewport.x + left,
        viewport.y + viewport.height - bottom,
        right - left,
        bottom - top,
      );
      gl.uniform4f(u.Rect, patch.x, patch.y, patch.width, patch.height);
      gl.uniform4f(
        u.Range,
        patch.captureLeft,
        patch.captureStart,
        patch.captureRight - patch.captureLeft,
        patch.captureEnd - patch.captureStart,
      );
      gl.uniform4f(
        u.Core,
        core.x / mask.width,
        core.y / mask.height,
        core.width / mask.width,
        core.height / mask.height,
      );
      gl.uniform3f(
        u.Levels,
        atlas.levels[Math.max(0, level - 1)],
        patch.sigma,
        atlas.levels[level + 1] ?? 1e30,
      );
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.disable(gl.BLEND);
    gl.activeTexture(gl.TEXTURE0);
  }

  dispose(): void {
    this.gl.deleteTexture(this.texture);
    this.gl.deleteVertexArray(this.geometry);
    this.gl.deleteProgram(this.program);
  }
}
