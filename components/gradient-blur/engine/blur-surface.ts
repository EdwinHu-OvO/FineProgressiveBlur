import type { CaptureReason } from "../types";
import type { SurfaceOverlayOptions } from "./surface-overlay";

export interface SceneTexture {
  readonly gl: WebGL2RenderingContext;
  readonly framebuffer: WebGLFramebuffer;
}

export interface BlurSurface {
  register(options: SurfaceOverlayOptions): () => void;
  request(reason: CaptureReason): void;
  setRadius(element: HTMLElement, radius: number): void;
}
