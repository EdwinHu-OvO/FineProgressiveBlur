import type {
  PaintBlockCommand,
  BorderPaintEdge,
  Rect,
} from "./vendor/frame-types";
import { cssPixels, readShadows } from "./dom-geometry";

const EDGES = ["top", "right", "bottom", "left"] as const;
const STYLES = new Set(["solid", "dotted", "dashed", "double"]);

export function readBlock(
  style: CSSStyleDeclaration,
  rect: Rect,
): PaintBlockCommand {
  const border: Record<string, BorderPaintEdge> = {};
  const borderBox = {
    topWidth: 0,
    rightWidth: 0,
    bottomWidth: 0,
    leftWidth: 0,
  };
  for (const edge of EDGES) {
    const width = cssPixels(style.getPropertyValue(`border-${edge}-width`));
    const kind = style.getPropertyValue(`border-${edge}-style`);
    if (width && kind !== "none" && kind !== "hidden") {
      if (!STYLES.has(kind))
        throw new Error(`Rito: unsupported ${kind} border`);
      border[edge] = {
        color: style.getPropertyValue(`border-${edge}-color`),
        style: kind as BorderPaintEdge["style"],
      };
      borderBox[`${edge}Width`] = width;
    }
  }
  const boxShadow = readShadows(style.boxShadow);
  if (boxShadow.some((shadow) => shadow.inset))
    throw new Error("Rito: inset box shadows are not supported");
  const corners = [
    style.borderTopLeftRadius,
    style.borderTopRightRadius,
    style.borderBottomRightRadius,
    style.borderBottomLeftRadius,
  ].map((value) => {
    if (value.includes(" "))
      throw new Error("Rito: elliptical corners are not supported");
    return value.endsWith("%")
      ? (cssPixels(value) / 100) * Math.min(rect.width, rect.height)
      : cssPixels(value);
  }) as [number, number, number, number];
  if (
    Object.keys(border).length &&
    !corners.every((radius) => radius === corners[0])
  )
    throw new Error(
      "Rito: borders with unequal corner radii are not supported",
    );
  return {
    kind: "paintBlock",
    rect,
    borderBox,
    paint: {
      background: { color: style.backgroundColor },
      border,
      radius: corners.every((radius) => radius === corners[0])
        ? { px: corners[0] }
        : { corners },
      boxShadow,
    },
  };
}

/** Guard unsupported paint before covering the original DOM with a partial frame. */
export function requireSupportedPaint(
  element: Element,
  style: CSSStyleDeclaration,
): void {
  const unsupported = [
    style.transform !== "none" && "transforms",
    style.translate && style.translate !== "none" && "individual transforms",
    style.rotate && style.rotate !== "none" && "individual transforms",
    style.scale && style.scale !== "none" && "individual transforms",
    style.filter !== "none" && "filters",
    style.backdropFilter &&
      style.backdropFilter !== "none" &&
      "backdrop filters",
    style.mixBlendMode !== "normal" && "blend modes",
    style.clipPath !== "none" && "clip paths",
    style.maskImage && style.maskImage !== "none" && "masks",
    style.writingMode !== "horizontal-tb" && "vertical writing",
    style.position === "fixed" && "fixed positioning",
    element.matches("input, textarea, select, iframe, video") &&
      "native embedded controls",
    element.shadowRoot && "shadow DOM",
    style.display === "list-item" &&
      style.listStyleType !== "none" &&
      "list markers",
  ].find(Boolean);
  if (unsupported) throw new Error(`Rito: ${unsupported} are not supported`);
  for (const pseudo of ["::before", "::after"]) {
    const pseudoStyle = getComputedStyle(element, pseudo);
    const content = pseudoStyle.content;
    if (
      pseudoStyle.display !== "none" &&
      content !== "none" &&
      content !== "normal"
    )
      throw new Error("Rito: generated content is not supported");
  }
}
