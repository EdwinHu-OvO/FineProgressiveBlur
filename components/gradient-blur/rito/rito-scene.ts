import { VERTEX_SHADER } from "../engine/shaders";
import { createProgram, requireUniform } from "../engine/webgl-utils";
import { InteractionPainter } from "./interaction-painter";
import type { InteractionLayer } from "./interaction";
import { SceneTiles } from "./scene-tiles";

const DISPLAY_SHADER = `#version 300 es
precision highp float;
uniform sampler2D uScene;
in vec2 vUv;
out vec4 color;
void main() {
  vec4 pixel = texture(uScene, vUv);
  vec3 rgb = mix(12.92 * pixel.rgb, 1.055 * pow(max(pixel.rgb, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), pixel.rgb));
  color = vec4(rgb * pixel.a, pixel.a);
}`;

/** A single context composes the cached document, interaction layers and gradient blur. */
export class RitoScene {
  readonly gl: WebGL2RenderingContext;
  readonly framebuffer: WebGLFramebuffer;
  readonly tiles: SceneTiles;
  private readonly texture: WebGLTexture;
  private readonly program: WebGLProgram;
  private readonly vertices: WebGLVertexArrayObject | null;
  private readonly sampler: WebGLUniformLocation;
  private readonly interaction: InteractionPainter;
  private width = 0;
  private height = 0;

  constructor(readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      powerPreference: "low-power",
    });
    if (!gl) throw new Error("WebGL2 is unavailable");
    this.gl = gl;
    const texture = gl.createTexture();
    const framebuffer = gl.createFramebuffer();
    if (!texture || !framebuffer)
      throw new Error("Unable to allocate Rito viewport");
    this.texture = texture;
    this.framebuffer = framebuffer;
    this.tiles = new SceneTiles(gl);
    this.interaction = new InteractionPainter(gl);
    this.program = createProgram(gl, VERTEX_SHADER, DISPLAY_SHADER);
    this.vertices = gl.createVertexArray();
    this.sampler = requireUniform(gl, this.program, "uScene");
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  resize(): boolean {
    const { width, height } = this.canvas;
    if (width === this.width && height === this.height) return false;
    const gl = this.gl;
    const limit = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    if (width > limit || height > limit)
      throw new Error("Rito: viewport exceeds the GPU texture limit");
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.SRGB8_ALPHA8,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.texture,
      0,
    );
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
      throw new Error("Rito viewport is not renderable");
    this.width = width;
    this.height = height;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return true;
  }

  compose(
    source: HTMLElement,
    ratio: number,
    layers: readonly InteractionLayer[],
  ): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.tiles.copyTo(
      this.framebuffer,
      source.scrollLeft,
      source.scrollTop,
      this.width,
      this.height,
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    this.interaction.paint(layers, ratio, source.scrollLeft, source.scrollTop);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  draw(): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vertices);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(this.sampler, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose(): void {
    this.tiles.dispose();
    this.interaction.dispose();
    this.gl.deleteFramebuffer(this.framebuffer);
    this.gl.deleteTexture(this.texture);
    this.gl.deleteProgram(this.program);
    this.gl.deleteVertexArray(this.vertices);
  }
}
