import type { NativeCanvas } from "./html-in-canvas-api";

export const OVERLAY_SLOT = "gradient-blur-overlay";

/** A shadow slot changes the rendered tree without moving React-owned nodes. */
export class NativeHost {
  readonly canvas = document.createElement("canvas") as NativeCanvas;
  readonly drawable = document.createElement("div");
  private readonly shadow: ShadowRoot;

  constructor(private readonly provider: HTMLDivElement) {
    this.shadow =
      provider.shadowRoot ?? provider.attachShadow({ mode: "open" });
    this.canvas.setAttribute("layoutsubtree", "");
    this.canvas.setAttribute("data-gradient-blur-native", "");
    this.canvas.style.cssText = "display:block;width:100%;height:100%;";
    this.drawable.setAttribute("drawable", "");
    this.drawable.style.cssText =
      "position:relative;box-sizing:border-box;transform:matrix(1,0,0,1,0,0);";
    this.drawable.append(document.createElement("slot"));
    this.canvas.append(this.drawable);
    const overlays = document.createElement("slot");
    overlays.name = OVERLAY_SLOT;
    this.shadow.replaceChildren(this.canvas, overlays);
  }

  resize(pixelRatio: number): boolean {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (width < 1 || height < 1) return false;
    const bufferWidth = Math.max(1, Math.round(width * pixelRatio));
    const bufferHeight = Math.max(1, Math.round(height * pixelRatio));
    const changed =
      this.canvas.width !== bufferWidth || this.canvas.height !== bufferHeight;
    if (changed) {
      this.canvas.width = bufferWidth;
      this.canvas.height = bufferHeight;
    }
    this.drawable.style.width = `${width}px`;
    this.drawable.style.height = `${height}px`;
    this.drawable.style.background = getComputedStyle(
      this.provider,
    ).backgroundColor;
    // Modern geometry uses backing-store coordinates; older Chromium uses CSS transforms.
    this.canvas.updateElementGeometry?.(this.drawable, {
      canvasTransform: new DOMMatrix().scale(
        bufferWidth / width,
        bufferHeight / height,
      ),
    });
    return changed;
  }

  dispose(): void {
    const overlays = document.createElement("slot");
    overlays.name = OVERLAY_SLOT;
    this.shadow.replaceChildren(document.createElement("slot"), overlays);
  }
}
