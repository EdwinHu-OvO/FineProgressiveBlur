import { resolveMaskPixels } from "./mask-pixels";
import type { BlurMaskOptions, ResolvedBlurMask } from "./types";

const MAX_MASK_PIXELS = 4096 * 4096;

async function loadImage(url: string, signal: AbortSignal) {
  const image = new Image();
  image.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      image.onload = image.onerror = null;
      signal.removeEventListener("abort", abort);
    };
    const abort = () => {
      cleanup();
      image.src = "";
      reject(signal.reason);
    };
    image.onload = () => {
      cleanup();
      resolve();
    };
    image.onerror = () => {
      cleanup();
      reject(
        new Error("Unable to load blur mask; check the URL and CORS headers"),
      );
    };
    signal.addEventListener("abort", abort, { once: true });
    image.src = url;
  });
  return image;
}

export async function loadBlurMask(
  options: BlurMaskOptions,
  signal: AbortSignal,
): Promise<ResolvedBlurMask> {
  signal.throwIfAborted();
  const source =
    typeof options.source === "string"
      ? await loadImage(options.source, signal)
      : options.source;
  if (source instanceof HTMLImageElement) await source.decode();
  signal.throwIfAborted();
  const width =
    source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const height =
    source instanceof HTMLImageElement ? source.naturalHeight : source.height;
  if (!width || !height || width * height > MAX_MASK_PIXELS)
    throw new Error(
      "Blur masks require nonzero dimensions and at most 16 megapixels",
    );
  if (source instanceof ImageData) return resolveMaskPixels(source, options);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Unable to read blur mask pixels");
  context.drawImage(source, 0, 0, width, height);
  return resolveMaskPixels(context.getImageData(0, 0, width, height), options);
}

export function maskAlphaUrl(mask: ResolvedBlurMask): string {
  const canvas = document.createElement("canvas");
  canvas.width = mask.width;
  canvas.height = mask.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to create blur mask fallback");
  const pixels = context.createImageData(mask.width, mask.height);
  for (let index = 0; index < mask.values.length; index++)
    pixels.data[index * 4 + 3] = mask.values[index];
  context.putImageData(pixels, 0, 0);
  return canvas.toDataURL();
}
