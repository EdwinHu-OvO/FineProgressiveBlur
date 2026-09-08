export const COMPARISON_IMAGE = "/images/blur-comparison.jpg";
export const COMPARISON_MAX_RADIUS = 48;
// Keep the Gaussian's visible support outside the clipped comparison frame.
export const COMPARISON_PADDING = COMPARISON_MAX_RADIUS * 3 + 1;

/** Both paths consume this exact bitmap, including the same extended edges. */
export function paintComparisonImage(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  width: number,
  height: number,
  pixelRatio: number,
): void {
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Canvas 2D is unavailable");
  canvas.width = Math.max(1, Math.round(width * pixelRatio));
  canvas.height = Math.max(1, Math.round(height * pixelRatio));
  const padding = Math.round(COMPARISON_PADDING * pixelRatio);
  const innerWidth = canvas.width - padding * 2;
  const innerHeight = canvas.height - padding * 2;
  const scale = Math.max(
    innerWidth / image.naturalWidth,
    innerHeight / image.naturalHeight,
  );
  const sourceWidth = innerWidth / scale;
  const sourceHeight = innerHeight / scale;
  context.drawImage(
    image,
    (image.naturalWidth - sourceWidth) / 2,
    (image.naturalHeight - sourceHeight) / 2,
    sourceWidth,
    sourceHeight,
    padding,
    padding,
    innerWidth,
    innerHeight,
  );

  // Clamp the photo's edges without zooming its composition or introducing a
  // transparent CSS fringe. Extending columns last also fills all four corners.
  context.drawImage(
    canvas,
    padding,
    padding,
    innerWidth,
    1,
    padding,
    0,
    innerWidth,
    padding,
  );
  context.drawImage(
    canvas,
    padding,
    padding + innerHeight - 1,
    innerWidth,
    1,
    padding,
    padding + innerHeight,
    innerWidth,
    padding,
  );
  context.drawImage(
    canvas,
    padding,
    0,
    1,
    canvas.height,
    0,
    0,
    padding,
    canvas.height,
  );
  context.drawImage(
    canvas,
    padding + innerWidth - 1,
    0,
    1,
    canvas.height,
    padding + innerWidth,
    0,
    padding,
    canvas.height,
  );
}
