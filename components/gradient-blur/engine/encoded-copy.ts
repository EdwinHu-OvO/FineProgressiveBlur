import type { TextureCrop } from "./atlas-texture";
import { VERTEX_SHADER } from "./shaders";
import { createProgram, requireUniform } from "./webgl-utils";

const FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uSource;
uniform vec4 uCrop;
uniform vec4 uDestination;
uniform bool uReduce;
out vec4 color;
vec4 encoded(ivec2 position) {
  ivec2 low = ivec2(uCrop.xy);
  ivec2 high = ivec2(uCrop.xy + uCrop.zw) - 1;
  vec4 p = texelFetch(uSource, clamp(position, low, high), 0);
  vec3 rgb = mix(12.92 * p.rgb,
    1.055 * pow(max(p.rgb, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055,
    step(vec3(0.0031308), p.rgb));
  return vec4(rgb * p.a, p.a);
}
void main() {
  vec2 pixel = uCrop.xy + (gl_FragCoord.xy - uDestination.xy) / uDestination.zw * uCrop.zw;
  if (!uReduce) { color = encoded(ivec2(floor(pixel))); return; }
  vec2 position = pixel - 0.5;
  ivec2 base = ivec2(floor(position));
  vec2 f = fract(position);
  // Convert before interpolation: CSS blur averages encoded sRGB, not light.
  color = mix(mix(encoded(base), encoded(base + ivec2(1, 0)), f.x),
    mix(encoded(base + ivec2(0, 1)), encoded(base + ivec2(1, 1)), f.x), f.y);
}`;

/** The scene textures stay sRGB for native display; only the blur uses RGBA8. */
export class EncodedCopy {
  private readonly program: WebGLProgram;
  private readonly vertexArray: WebGLVertexArrayObject;
  private readonly uniforms: Record<
    "source" | "crop" | "destination" | "reduce",
    WebGLUniformLocation
  >;

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.program = createProgram(gl, VERTEX_SHADER, FRAGMENT);
    const vertexArray = gl.createVertexArray();
    if (!vertexArray) throw new Error("Unable to create copy geometry");
    this.vertexArray = vertexArray;
    const get = (name: string) => requireUniform(gl, this.program, name);
    this.uniforms = {
      source: get("uSource"),
      crop: get("uCrop"),
      destination: get("uDestination"),
      reduce: get("uReduce"),
    };
  }

  draw(
    source: WebGLFramebuffer,
    crop: TextureCrop,
    target: WebGLFramebuffer,
    destination: TextureCrop,
  ): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, source);
    const texture: WebGLTexture | null = gl.getFramebufferAttachmentParameter(
      gl.READ_FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.FRAMEBUFFER_ATTACHMENT_OBJECT_NAME,
    );
    if (!texture)
      throw new Error("The source framebuffer has no color texture");
    gl.bindFramebuffer(gl.FRAMEBUFFER, target);
    gl.viewport(
      destination.x,
      destination.y,
      destination.width,
      destination.height,
    );
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vertexArray);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(this.uniforms.source, 0);
    gl.uniform4f(this.uniforms.crop, crop.x, crop.y, crop.width, crop.height);
    gl.uniform4f(
      this.uniforms.destination,
      destination.x,
      destination.y,
      destination.width,
      destination.height,
    );
    gl.uniform1i(
      this.uniforms.reduce,
      crop.width !== destination.width || crop.height !== destination.height
        ? 1
        : 0,
    );
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose(): void {
    this.gl.deleteProgram(this.program);
    this.gl.deleteVertexArray(this.vertexArray);
  }
}
