import { DomGeometry } from "./dom-geometry";
import { selectionGeometry } from "./selection-geometry";
import type { Rect } from "./vendor/frame-types";

export interface InteractionLayer {
  rects: readonly Rect[];
  color: readonly [number, number, number, number];
  zIndex: number;
  border?: boolean;
}

/** The original DOM owns input, copy, links and accessibility; Canvas mirrors its state. */
export class RitoInteraction {
  constructor(
    private readonly source: HTMLElement,
    changed: () => void,
  ) {
    this.changed = changed;
    document.addEventListener("selectionchange", this.changed);
    source.addEventListener("focusin", this.changed);
    source.addEventListener("focusout", this.changed);
    source.addEventListener("keydown", this.changed);
  }
  private readonly changed: () => void;

  layers(): readonly InteractionLayer[] {
    const geometry = new DomGeometry(this.source);
    const layers: InteractionLayer[] = [];
    const rects = selectionGeometry(this.source, document.getSelection());
    if (rects.length)
      layers.push({ rects, color: [0.35, 0.55, 0.78, 0.3], zIndex: 0 });
    const focused = document.activeElement;
    if (
      focused instanceof HTMLElement &&
      this.source.contains(focused) &&
      focused.matches(":focus-visible")
    ) {
      layers.push({
        rects: [geometry.rect(focused.getBoundingClientRect())],
        color: [0.3, 0.45, 0.62, 0.9],
        zIndex: 1,
        border: true,
      });
    }
    return layers;
  }

  dispose(): void {
    document.removeEventListener("selectionchange", this.changed);
    this.source.removeEventListener("focusin", this.changed);
    this.source.removeEventListener("focusout", this.changed);
    this.source.removeEventListener("keydown", this.changed);
  }
}
