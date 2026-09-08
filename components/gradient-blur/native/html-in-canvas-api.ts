interface ElementImage {
  readonly width: number;
  readonly height: number;
  close(): void;
}

export interface NativeCanvas extends HTMLCanvasElement {
  requestPaint(): void;
  updateElementGeometry?: (
    element: Element,
    options: { canvasTransform: DOMMatrix },
  ) => void;
}

interface UploadConfig {
  width: number;
  height: number;
}

export interface NativeContext extends WebGL2RenderingContext {
  texElementSubImage2D?: (
    target: number,
    level: number,
    x: number,
    y: number,
    source: Element | ElementImage,
    config: UploadConfig,
  ) => void;
  texElementImage2D?: (
    target: number,
    internalFormat: number,
    source: Element | ElementImage,
    config: UploadConfig,
  ) => void;
}

export function supportsNativeCanvas(): boolean {
  if (
    typeof HTMLCanvasElement === "undefined" ||
    typeof WebGL2RenderingContext === "undefined"
  )
    return false;
  const canvas = HTMLCanvasElement.prototype as NativeCanvas;
  const gl = WebGL2RenderingContext.prototype as NativeContext;
  return (
    typeof canvas.requestPaint === "function" &&
    (typeof gl.texElementSubImage2D === "function" ||
      // Chromium's older six-argument API has no crop/resize contract. Use Rito.
      (typeof gl.texElementImage2D === "function" &&
        gl.texElementImage2D.length === 3))
  );
}

/** DOM and GPU texture must belong to the same canvas in current Chromium. */
export function uploadNativeElement(
  gl: NativeContext,
  element: HTMLElement,
  width: number,
  height: number,
  resized: boolean,
): void {
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  if (gl.texElementSubImage2D) {
    if (resized)
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
    gl.texElementSubImage2D(gl.TEXTURE_2D, 0, 0, 0, element, { width, height });
  } else if (gl.texElementImage2D?.length === 3) {
    gl.texElementImage2D(gl.TEXTURE_2D, gl.SRGB8_ALPHA8, element, {
      width,
      height,
    });
  } else {
    throw new Error("HTML-in-Canvas texture upload is unavailable");
  }
}
