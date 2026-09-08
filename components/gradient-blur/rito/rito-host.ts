import { OVERLAY_SLOT } from "../native/native-host";

export class RitoHost {
  readonly canvas = document.createElement("canvas");
  constructor(
    private readonly provider: HTMLElement,
    private readonly source: HTMLElement,
  ) {
    this.canvas.dataset.gradientBlurRito = "";
    this.canvas.setAttribute("aria-hidden", "true");
    this.canvas.slot = OVERLAY_SLOT;
    this.canvas.style.cssText =
      "position:absolute;pointer-events:none;z-index:1;visibility:hidden;display:block;";
    provider.append(this.canvas);
  }

  resize(ratio: number): void {
    const bounds = this.source.getBoundingClientRect();
    const parent = this.provider.getBoundingClientRect();
    const { clientWidth: width, clientHeight: height } = this.source;
    this.canvas.style.left = `${bounds.left + this.source.clientLeft - parent.left - this.provider.clientLeft}px`;
    this.canvas.style.top = `${bounds.top + this.source.clientTop - parent.top - this.provider.clientTop}px`;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    const bufferWidth = Math.max(1, Math.round(width * ratio));
    const bufferHeight = Math.max(1, Math.round(height * ratio));
    if (this.canvas.width !== bufferWidth) this.canvas.width = bufferWidth;
    if (this.canvas.height !== bufferHeight) this.canvas.height = bufferHeight;
  }

  show(): void {
    this.canvas.style.visibility = "visible";
  }
  dispose(): void {
    this.canvas.remove();
  }
}
