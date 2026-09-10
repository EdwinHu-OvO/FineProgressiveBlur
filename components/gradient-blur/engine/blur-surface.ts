import type { CaptureReason } from "../types";
import type { SurfaceOverlayOptions } from "./surface-overlay";

export interface SceneTexture {
  readonly gl: WebGL2RenderingContext;
  readonly framebuffer: WebGLFramebuffer;
}

export interface BlurSurface {
  register(options: SurfaceOverlayOptions): () => void;
  request(reason: CaptureReason): void;
  /** Geometry-only invalidation; must not recapture the Provider's source. */
  requestOverlay(element: HTMLElement): void;
  setRadius(element: HTMLElement, radius: number): void;
}
