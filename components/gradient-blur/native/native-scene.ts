import { VERTEX_SHADER } from "../engine/shaders";
import { createProgram, requireUniform } from "../engine/webgl-utils";
import {
  uploadNativeElement,
  type NativeCanvas,
  type NativeContext,
} from "./html-in-canvas-api";

const DISPLAY_SHADER = `#version 300 es
precision highp float;
uniform sampler2D uScene;
in vec2 vUv;
out vec4 color;
void main() {
  vec4 pixel = texture(uScene, vUv);
  vec3 rgb = mix(12.92 * pixel.rgb,
    1.055 * pow(max(pixel.rgb, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055,
    step(vec3(0.0031308), pixel.rgb));
  color = vec4(rgb * pixel.a, pixel.a);
}`;

/** One native DOM texture, shared by the normal scene and all blur overlays. */
export class NativeScene {
  readonly gl: NativeContext;
  readonly framebuffer: WebGLFramebuffer;
  private readonly texture: WebGLTexture;
  private readonly program: WebGLProgram;
  private readonly vertexArray: WebGLVertexArrayObject;
  private readonly sampler: WebGLUniformLocation;
  private width = 0;
  private height = 0;

  constructor(private readonly canvas: NativeCanvas) {
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      powerPreference: "low-power",
    }) as NativeContext | null;
    if (!gl) throw new Error("WebGL2 is unavailable");
    this.gl = gl;
    const texture = gl.createTexture();
    const framebuffer = gl.createFramebuffer();
    const vertexArray = gl.createVertexArray();
    if (!texture || !framebuffer || !vertexArray)
      throw new Error("Unable to create native scene");
    this.texture = texture;
    this.framebuffer = framebuffer;
    this.vertexArray = vertexArray;
    this.program = createProgram(gl, VERTEX_SHADER, DISPLAY_SHADER);
    this.sampler = requireUniform(gl, this.program, "uScene");
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  capture(element: HTMLElement): void {
    const gl = this.gl;
    const { width, height } = this.canvas;
    const resized = width !== this.width || height !== this.height;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    uploadNativeElement(gl, element, width, height, resized);
    if (resized) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        this.texture,
        0,
      );
      if (
        gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE ||
        gl.getError() !== gl.NO_ERROR
      ) {
        throw new Error("HTML-in-Canvas texture is not renderable");
      }
      this.width = width;
      this.height = height;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  get needsResize(): boolean {
    return (
      this.canvas.width !== this.width || this.canvas.height !== this.height
    );
  }

  draw(): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vertexArray);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(this.sampler, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteFramebuffer(this.framebuffer);
    gl.deleteTexture(this.texture);
    gl.deleteProgram(this.program);
    gl.deleteVertexArray(this.vertexArray);
  }
}
