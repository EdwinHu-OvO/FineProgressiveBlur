export type BlurMaskSource =
  | string
  | HTMLImageElement
  | HTMLCanvasElement
  | OffscreenCanvas
  | ImageBitmap
  | ImageData;

export interface BlurMaskOptions {
  source: BlurMaskSource;
  /** Luminance is multiplied by alpha. White/opaque means maximum blur. */
  channel?: "luminance" | "alpha";
  invert?: boolean;
  /** Change after mutating a canvas or ImageData in place. */
  revision?: string | number;
}

export type BlurMask = string | BlurMaskOptions;

/** Immutable, top-to-bottom strength samples, shared by CPU planning and GPU. */
export interface ResolvedBlurMask {
  width: number;
  height: number;
  values: Uint8Array;
}
