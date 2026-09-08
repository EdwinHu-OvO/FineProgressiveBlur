import { RenderTarget } from "./render-target";
import { VERTEX_SHADER } from "./shaders";
import { createProgram, requireUniform } from "./webgl-utils";

const FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uSource;
uniform vec2 uSourceSize;
uniform vec2 uTargetSize;
out vec4 color;
void main() {
  // A ceil-sized 2x reduction may cover THREE source texels on either axis.
  // Integrate their coverage instead of sampling only the destination center:
  // that aliases alternating strokes into a brightness ramp on odd sizes.
  vec2 ratio = uSourceSize / uTargetSize;
  vec2 low = (gl_FragCoord.xy - 0.5) * ratio;
  vec2 high = low + ratio;
  vec2 base = floor(low);
  vec2 a = min(base + 1.0, high) - low;
  vec2 b = clamp(high - base - 1.0, 0.0, 1.0);
  vec2 c = max(high - base - 2.0, 0.0);
  vec2 paired = a + b;
  vec2 first = (base + 0.5 + b / paired) / uSourceSize;
  vec2 last = min(base + 2.5, uSourceSize - 0.5) / uSourceSize;
  color = texture(uSource, first) * paired.x * paired.y;
  if (c.x > 0.0) color += texture(uSource, vec2(last.x, first.y)) * c.x * paired.y;
  if (c.y > 0.0) color += texture(uSource, vec2(first.x, last.y)) * paired.x * c.y;
  if (c.x * c.y > 0.0) color += texture(uSource, last) * c.x * c.y;
  color /= ratio.x * ratio.y;
}`;

/** Exact box coverage for the encoded RGBA pyramid, with at most four reads. */
export class PyramidReduction {
  private readonly program: WebGLProgram;
  private readonly vertexArray: WebGLVertexArrayObject;
  private readonly uniforms: Record<
    "source" | "sourceSize" | "targetSize",
    WebGLUniformLocation
  >;

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.program = createProgram(gl, VERTEX_SHADER, FRAGMENT);
    const vertexArray = gl.createVertexArray();
    if (!vertexArray) throw new Error("Unable to create pyramid geometry");
    this.vertexArray = vertexArray;
    this.uniforms = {
      source: requireUniform(gl, this.program, "uSource"),
      sourceSize: requireUniform(gl, this.program, "uSourceSize"),
      targetSize: requireUniform(gl, this.program, "uTargetSize"),
    };
  }

  draw(source: RenderTarget, target: RenderTarget): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
    gl.viewport(0, 0, target.width, target.height);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vertexArray);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, source.texture);
    gl.uniform1i(this.uniforms.source, 0);
    gl.uniform2f(this.uniforms.sourceSize, source.width, source.height);
    gl.uniform2f(this.uniforms.targetSize, target.width, target.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose(): void {
    this.gl.deleteVertexArray(this.vertexArray);
    this.gl.deleteProgram(this.program);
  }
}
