import { DomGeometry } from "./dom-geometry";
import { mergeLineRects } from "./vendor/selection-rects";
import type { Rect } from "./vendor/frame-types";

/** Use text fragments, never ancestor element boxes that cover whole paragraphs. */
export function selectionGeometry(
  source: HTMLElement,
  selection: Selection | null,
): readonly Rect[] {
  if (!selection || selection.isCollapsed || !selection.rangeCount) return [];
  const selected = selection.getRangeAt(0);
  if (!selected.intersectsNode(source)) return [];
  const geometry = new DomGeometry(source);
  const walker = document.createTreeWalker(source, NodeFilter.SHOW_TEXT);
  const rects: Rect[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (!node.textContent?.trim() || !selected.intersectsNode(node)) continue;
    const range = document.createRange();
    range.setStart(
      node,
      node === selected.startContainer ? selected.startOffset : 0,
    );
    range.setEnd(
      node,
      node === selected.endContainer
        ? selected.endOffset
        : node.textContent.length,
    );
    rects.push(
      ...Array.from(range.getClientRects())
        .filter((rect) => rect.width > 0 && rect.height > 0)
        .map((rect) => geometry.rect(rect)),
    );
  }
  return mergeLineRects(rects);
}
