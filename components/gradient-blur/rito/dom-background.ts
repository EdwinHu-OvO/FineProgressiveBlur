import type { CoreFrameCommand, Rect } from "./vendor/frame-types";

/** Resolve translucent source backgrounds against an explicit, opaque ancestor. */
export function readSourceBackground(
  source: HTMLElement,
  rect: Rect,
): CoreFrameCommand[] {
  const colors: string[] = [];
  for (let node: HTMLElement | null = source; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (style.backgroundImage !== "none")
      throw new Error("Rito: complex source backgrounds are not supported");
    const color = style.backgroundColor;
    colors.push(color);
    const opaque =
      color.startsWith("rgb(") ||
      (color.startsWith("color(") && !color.includes("/"));
    if (opaque)
      return colors.reverse().map((backgroundColor) => ({
        kind: "paintPage",
        rect,
        paint: { backgroundColor },
      }));
  }
  throw new Error("Rito requires an opaque source or ancestor background");
}
