import type {
  TwinImageNode,
  TwinPaintNode,
  TwinRect,
  TwinRectNode,
  TwinSceneSnapshot,
  TwinTextNode,
} from "./types";

interface ScanContext {
  originX: number;
  originY: number;
  source: HTMLElement;
  nodes: TwinPaintNode[];
}

/** Reads a deliberately small, paintable subset of DOM into scene-space CSS px. */
export function scanTwinScene(source: HTMLElement): TwinSceneSnapshot {
  const sourceBounds = source.getBoundingClientRect();
  const context: ScanContext = {
    nodes: [],
    originX: sourceBounds.left + source.clientLeft,
    originY: sourceBounds.top + source.clientTop,
    source,
  };

  for (const child of Array.from(source.childNodes)) {
    visitNode(child, context, 1);
  }

  const sourceStyle = getComputedStyle(source);
  return {
    backgroundColor: sourceStyle.backgroundColor,
    nodes: context.nodes,
    sourceHeight: Math.max(source.clientHeight, sourceBounds.height, 1),
    sourceWidth: Math.max(source.clientWidth, sourceBounds.width, 1),
  };
}

function visitNode(
  node: Node,
  context: ScanContext,
  inheritedOpacity: number,
): void {
  if (node.nodeType === Node.TEXT_NODE) {
    context.nodes.push(
      ...scanTextNode(node as Text, context, inheritedOpacity),
    );
    return;
  }
  if (!(node instanceof HTMLElement)) return;
  if (
    node.hasAttribute("data-gradient-blur-overlay") ||
    node.hasAttribute("data-gradient-blur-twin-ignore")
  ) {
    return;
  }

  const style = getComputedStyle(node);
  if (style.display === "none" || style.visibility === "hidden") return;
  const opacity = inheritedOpacity * toNumber(style.opacity, 1);
  if (opacity <= 0) return;

  if (node instanceof HTMLImageElement) {
    const image = scanImageNode(node, context, opacity);
    if (image) context.nodes.push(image);
    return;
  }

  const background = scanBackgroundNode(node, context, opacity, style);
  if (background) context.nodes.push(background);
  for (const child of Array.from(node.childNodes)) {
    visitNode(child, context, opacity);
  }
}

function scanTextNode(
  node: Text,
  context: ScanContext,
  opacity: number,
): TwinTextNode[] {
  const value = node.nodeValue ?? "";
  if (!value.trim()) return [];
  const parent = node.parentElement;
  if (!parent) return [];
  const style = getComputedStyle(parent);
  if (style.display === "none" || style.visibility === "hidden") return [];
  const font = [
    style.fontStyle,
    style.fontVariant,
    style.fontWeight,
    style.fontSize,
    style.fontFamily,
  ]
    .filter(Boolean)
    .join(" ");
  const lines: TextLine[] = [];
  const range = document.createRange();

  for (let offset = 0; offset < value.length; offset += 1) {
    let rect: DOMRect | null = null;
    try {
      range.setStart(node, offset);
      range.setEnd(node, offset + 1);
      rect =
        Array.from(range.getClientRects()).find(
          (candidate) => candidate.width > 0 || candidate.height > 0,
        ) ?? null;
    } catch {
      continue;
    }
    if (!rect) continue;
    const line = lines.at(-1);
    if (!line || Math.abs(line.top - rect.top) > 1) {
      lines.push({
        bottom: rect.bottom,
        left: rect.left,
        text: value[offset] ?? "",
        top: rect.top,
        right: rect.right,
      });
      continue;
    }
    line.text += value[offset] ?? "";
    line.left = Math.min(line.left, rect.left);
    line.right = Math.max(line.right, rect.right);
    line.bottom = Math.max(line.bottom, rect.bottom);
  }
  range.detach?.();

  return lines
    .filter((line) => line.text.trim())
    .map((line) => ({
      color: style.color,
      font,
      kind: "text",
      letterSpacing: parseLength(style.letterSpacing),
      opacity,
      rect: toLocalRect(line, context),
      text: line.text,
    }));
}

interface TextLine {
  bottom: number;
  left: number;
  right: number;
  text: string;
  top: number;
}

function scanImageNode(
  image: HTMLImageElement,
  context: ScanContext,
  opacity: number,
): TwinImageNode | null {
  const rect = image.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  const style = getComputedStyle(image);
  return {
    borderRadius: parseRadius(
      style.borderTopLeftRadius,
      rect.width,
      rect.height,
    ),
    image,
    kind: "image",
    objectFit: style.objectFit,
    objectPosition: style.objectPosition,
    opacity,
    rect: toLocalRect(rect, context),
  };
}

function scanBackgroundNode(
  element: HTMLElement,
  context: ScanContext,
  opacity: number,
  style: CSSStyleDeclaration,
): TwinRectNode | null {
  if (isTransparent(style.backgroundColor)) return null;
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return {
    borderRadius: parseRadius(
      style.borderTopLeftRadius,
      rect.width,
      rect.height,
    ),
    color: style.backgroundColor,
    kind: "rect",
    opacity,
    rect: toLocalRect(rect, context),
  };
}

function toLocalRect(rect: DOMRect | TextLine, context: ScanContext): TwinRect {
  const left = "left" in rect ? rect.left : 0;
  const top = rect.top;
  const right = "right" in rect ? rect.right : left;
  const bottom = rect.bottom;
  return {
    height: Math.max(0, bottom - top),
    width: Math.max(0, right - left),
    x: left - context.originX + context.source.scrollLeft,
    y: top - context.originY + context.source.scrollTop,
  };
}

function parseLength(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseRadius(value: string, width: number, height: number): number {
  if (value.endsWith("%")) {
    return (parseLength(value) / 100) * Math.min(width, height);
  }
  return Math.max(0, parseLength(value));
}

function toNumber(value: string, fallback: number): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isTransparent(color: string): boolean {
  return color === "transparent" || color === "rgba(0, 0, 0, 0)";
}
