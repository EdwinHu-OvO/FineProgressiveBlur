import { VERTEX_SHADER } from "./shaders";
import { createProgram, requireUniform } from "./webgl-utils";

const COMPARE_SHADER = `#version 300 es
precision highp float;
uniform highp sampler2D uPrevious;
uniform highp sampler2D uCurrent;
out vec4 color;
void main() {
  ivec2 point = ivec2(gl_FragCoord.xy);
  if (all(equal(texelFetch(uPrevious, point, 0), texelFetch(uCurrent, point, 0)))) discard;
  color = vec4(1.0);
}`;

/** Full-resolution equality on the GPU; only an asynchronous boolean crosses to JS. */
export class TextureComparison {
  private readonly program: WebGLProgram;
  private readonly vertexArray: WebGLVertexArrayObject;
  private readonly framebuffer: WebGLFramebuffer;
  private readonly buffer: WebGLRenderbuffer;
  private readonly previous: WebGLUniformLocation;
  private readonly current: WebGLUniformLocation;
  private width = 0;
  private height = 0;
  private cancelPending: (() => void) | null = null;

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.program = createProgram(gl, VERTEX_SHADER, COMPARE_SHADER);
    const vertexArray = gl.createVertexArray();
    const framebuffer = gl.createFramebuffer();
    const buffer = gl.createRenderbuffer();
    if (!vertexArray || !framebuffer || !buffer)
      throw new Error("Unable to create texture comparison");
    this.vertexArray = vertexArray;
    this.framebuffer = framebuffer;
    this.buffer = buffer;
    this.previous = requireUniform(gl, this.program, "uPrevious");
    this.current = requireUniform(gl, this.program, "uCurrent");
  }

  differs(
    previous: WebGLTexture,
    current: WebGLTexture,
    width: number,
    height: number,
    signal: AbortSignal,
  ): Promise<boolean> {
    signal.throwIfAborted();
    if (this.cancelPending)
      throw new Error("Texture comparisons must be serialized");
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    if (width !== this.width || height !== this.height) {
      gl.bindRenderbuffer(gl.RENDERBUFFER, this.buffer);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.R8, width, height);
      gl.framebufferRenderbuffer(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.RENDERBUFFER,
        this.buffer,
      );
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
        throw new Error("Texture comparison target is not renderable");
      this.width = width;
      this.height = height;
    }
    const query = gl.createQuery();
    if (!query) throw new Error("Unable to create texture query");
    gl.viewport(0, 0, width, height);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.STENCIL_TEST);
    gl.disable(gl.SCISSOR_TEST);
    gl.disable(gl.BLEND);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vertexArray);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, previous);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, current);
    gl.uniform1i(this.previous, 0);
    gl.uniform1i(this.current, 1);
    gl.colorMask(false, false, false, false);
    gl.beginQuery(gl.ANY_SAMPLES_PASSED, query);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.endQuery(gl.ANY_SAMPLES_PASSED);
    gl.colorMask(true, true, true, true);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

    return new Promise((resolve, reject) => {
      let frame = 0;
      const finish = (error?: unknown) => {
        cancelAnimationFrame(frame);
        signal.removeEventListener("abort", abort);
        this.cancelPending = null;
        if (error) reject(error);
        else resolve(Boolean(gl.getQueryParameter(query, gl.QUERY_RESULT)));
        gl.deleteQuery(query);
      };
      const abort = () =>
        finish(signal.reason ?? new DOMException("Cancelled", "AbortError"));
      const poll = () => {
        if (gl.isContextLost())
          finish(new Error("WebGL context lost during texture comparison"));
        else if (gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE))
          finish();
        else frame = requestAnimationFrame(poll);
      };
      this.cancelPending = () =>
        finish(new DOMException("Disposed", "AbortError"));
      signal.addEventListener("abort", abort, { once: true });
      // Query results cannot become available in the task that submits them.
      frame = requestAnimationFrame(poll);
    });
  }

  dispose(): void {
    this.cancelPending?.();
    const gl = this.gl;
    gl.deleteProgram(this.program);
    gl.deleteVertexArray(this.vertexArray);
    gl.deleteFramebuffer(this.framebuffer);
    gl.deleteRenderbuffer(this.buffer);
  }
}
