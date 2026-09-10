import type { OverlayRenderProfile } from "./overlay-mode";
import type { TextureCrop } from "./atlas-texture";

export interface OverlayCaptureRegion {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

/** Capture non-gradient neighborhoods beyond output bounds, within the scene. */
export function overlayCapture(
  canvas: HTMLCanvasElement,
  source: DOMRect,
  overlay: DOMRect,
  profile: OverlayRenderProfile,
  needsHalo: boolean,
) {
  const bounds = canvas.getBoundingClientRect();
  const scaleX = canvas.width / bounds.width,
    scaleY = canvas.height / bounds.height;
  const left = Math.max(source.left, overlay.left),
    top = Math.max(source.top, overlay.top);
  const right = Math.min(source.right, overlay.right),
    bottom = Math.min(source.bottom, overlay.bottom);
  if (right <= left || bottom <= top) return null;
  const coreLeft = Math.round((left - bounds.left) * scaleX);
  const coreTop = Math.round((top - bounds.top) * scaleY);
  const coreRight = Math.round((right - bounds.left) * scaleX);
  const coreBottom = Math.round((bottom - bounds.top) * scaleY);
  const radius = Number.isFinite(profile.maxRadius)
    ? Math.max(0, profile.maxRadius)
    : 0;
  // 3 sigma plus the coarsest level's reconstruction guard, rounded outward.
  const haloX =
    needsHalo && radius > 0 ? Math.ceil(4 * radius * scaleX + 2) : 0;
  const haloY =
    needsHalo && radius > 0 ? Math.ceil(4 * radius * scaleY + 2) : 0;
  const x = Math.max(
    0,
    Math.round((source.left - bounds.left) * scaleX),
    coreLeft - haloX,
  );
  const y = Math.max(
    0,
    Math.round((source.top - bounds.top) * scaleY),
    coreTop - haloY,
  );
  const endX = Math.min(
    canvas.width,
    Math.round((source.right - bounds.left) * scaleX),
    coreRight + haloX,
  );
  const endY = Math.min(
    canvas.height,
    Math.round((source.bottom - bounds.top) * scaleY),
    coreBottom + haloY,
  );
  const crop: TextureCrop = { x, y, width: endX - x, height: endY - y };
  if (
    crop.width < 1 ||
    crop.height < 1 ||
    coreRight <= coreLeft ||
    coreBottom <= coreTop
  )
    return null;
  return {
    width: coreRight - coreLeft,
    height: coreBottom - coreTop,
    crop,
    view: { width: crop.width / scaleX, height: crop.height / scaleY },
    sampleRegion: needsHalo
      ? {
          width: crop.width,
          height: crop.height,
          offsetX: coreLeft - x,
          offsetY: coreTop - y,
        }
      : undefined,
  };
}
