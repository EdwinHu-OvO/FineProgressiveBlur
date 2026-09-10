import type { BlurMaskOptions, ResolvedBlurMask } from "./types";

export function resolveMaskPixels(
  pixels: Pick<ImageData, "width" | "height" | "data">,
  options: Pick<BlurMaskOptions, "channel" | "invert">,
): ResolvedBlurMask {
  const { width, height, data } = pixels;
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    data.length !== width * height * 4
  )
    throw new Error("Invalid blur mask dimensions or pixels");
  const values = new Uint8Array(width * height);
  for (let index = 0; index < values.length; index++) {
    const offset = index * 4;
    const alpha = data[offset + 3];
    const strength =
      options.channel === "alpha"
        ? alpha
        : ((0.2126 * data[offset] +
            0.7152 * data[offset + 1] +
            0.0722 * data[offset + 2]) *
            alpha) /
          255;
    values[index] = Math.round(options.invert ? 255 - strength : strength);
  }
  return { width, height, values };
}
