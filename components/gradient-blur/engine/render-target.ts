/** Reusable encoded, premultiplied RGBA storage for the CSS-compatible passes. */
export class RenderTarget {
  readonly texture: WebGLTexture;
  readonly framebuffer: WebGLFramebuffer;
  width = 0;
  height = 0;

  constructor(private readonly gl: WebGL2RenderingContext) {
    const texture = gl.createTexture();
    const framebuffer = gl.createFramebuffer();
    if (!texture || !framebuffer)
      throw new Error("Unable to create render target");
    this.texture = texture;
    this.framebuffer = framebuffer;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  resize(width: number, height: number): void {
    if (this.width === width && this.height === height) return;
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA8,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
    // Some Android WebViews retain an incomplete attachment when the texture
    // is attached before storage exists. Attach again after every allocation.
    const previousDrawFramebuffer = gl.getParameter(
      gl.DRAW_FRAMEBUFFER_BINDING,
    ) as WebGLFramebuffer | null;
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.framebuffer);
    try {
      gl.framebufferTexture2D(
        gl.DRAW_FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        this.texture,
        0,
      );
      const status = gl.checkFramebufferStatus(gl.DRAW_FRAMEBUFFER);
      if (status !== gl.FRAMEBUFFER_COMPLETE)
        throw new Error(
          `Blur render target is incomplete: 0x${status.toString(16)}`,
        );
    } finally {
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, previousDrawFramebuffer);
    }
    this.width = width;
    this.height = height;
  }

  dispose(): void {
    this.gl.deleteFramebuffer(this.framebuffer);
    this.gl.deleteTexture(this.texture);
  }
}
