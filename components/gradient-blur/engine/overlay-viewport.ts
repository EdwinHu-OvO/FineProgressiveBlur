import type { TextureCrop } from "./atlas-texture";

export function overlayViewport(
  canvas: HTMLCanvasElement,
  element: HTMLElement,
  sourceBounds?: DOMRect,
): TextureCrop {
  const bounds = canvas.getBoundingClientRect();
  const overlay = element.getBoundingClientRect();
  const region = sourceBounds
    ? {
        left: Math.max(overlay.left, sourceBounds.left),
        bottom: Math.min(overlay.bottom, sourceBounds.bottom),
        width: Math.max(
          0,
          Math.min(overlay.right, sourceBounds.right) -
            Math.max(overlay.left, sourceBounds.left),
        ),
        height: Math.max(
          0,
          Math.min(overlay.bottom, sourceBounds.bottom) -
            Math.max(overlay.top, sourceBounds.top),
        ),
      }
    : overlay;
  const scaleX = canvas.width / bounds.width;
  const scaleY = canvas.height / bounds.height;
  return {
    x: Math.round((region.left - bounds.left) * scaleX),
    y: Math.round((bounds.bottom - region.bottom) * scaleY),
    width: Math.round(region.width * scaleX),
    height: Math.round(region.height * scaleY),
  };
}
