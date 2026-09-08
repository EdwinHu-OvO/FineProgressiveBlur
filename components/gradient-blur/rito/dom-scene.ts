import type { CoreFrameCommand, Rect } from "./vendor/frame-types";
import { DomGeometry, cssPixels } from "./dom-geometry";
import { readBlock, requireSupportedPaint } from "./dom-block";
import { DomResources } from "./dom-resources";
import { readText } from "./dom-text";
import { readSourceBackground } from "./dom-background";

export interface DomScene {
  commands: readonly CoreFrameCommand[];
  images: ReadonlyMap<string, ImageBitmap | HTMLImageElement>;
  width: number;
  height: number;
  scrollSensitive: boolean;
}

export async function readDomScene(
  source: HTMLElement,
  resources: DomResources,
  signal: AbortSignal,
  pixelRatio = 1,
): Promise<DomScene> {
  if (source instanceof HTMLCanvasElement)
    throw new Error(
      "Rito requires an HTML scroll container; use the Canvas capture adapter for a Canvas source",
    );
  const geometry = new DomGeometry(source);
  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) throw new Error("Canvas 2D is unavailable");
  const commands: CoreFrameCommand[] = [];
  const images = new Map<string, ImageBitmap | HTMLImageElement>();
  let scrollSensitive = false;
  const rootStyle = getComputedStyle(source);
  requireSupportedPaint(source, rootStyle);
  if (rootStyle.opacity !== "1")
    throw new Error("Rito: transparent source groups are not supported");
  if (rootStyle.backgroundImage !== "none")
    throw new Error("Rito: source background images are not supported");
  commands.push(
    ...readSourceBackground(source, {
      x: 0,
      y: 0,
      width: geometry.width,
      height: geometry.height,
    }),
  );

  const visit = async (node: Node): Promise<void> => {
    signal.throwIfAborted();
    if (node instanceof Text) {
      commands.push(...readText(node, geometry, measure));
      return;
    }
    if (
      !(node instanceof Element) ||
      node.matches(
        "script, style, link, [data-gradient-blur-overlay], [data-gradient-blur-rito], [data-gradient-blur-twin-ignore]",
      )
    )
      return;
    const style = getComputedStyle(node);
    if (
      style.display === "none" ||
      style.visibility !== "visible" ||
      Number(style.opacity) === 0
    )
      return;
    requireSupportedPaint(node, style);
    scrollSensitive ||= style.position === "sticky";
    const bounds = node.getBoundingClientRect();
    const rect = geometry.rect(bounds);
    commands.push({ kind: "pushState" });
    if (style.opacity !== "1")
      commands.push({ kind: "opacity", value: Number(style.opacity) });
    const block = readBlock(style, rect);
    if (style.backgroundImage !== "none") {
      const match = /^url\(["']?(.*?)["']?\)$/.exec(style.backgroundImage);
      if (
        !match ||
        !["cover", "contain", "auto", "auto auto"].includes(
          style.backgroundSize,
        )
      )
        throw new Error("Rito: complex backgrounds are not supported");
      const [key, image] = await resources.background(match[1]);
      images.set(key, image);
      const position = (value: string) => ({
        unit: value.endsWith("%") ? ("percent" as const) : ("px" as const),
        value: cssPixels(value),
      });
      commands.push({
        ...block,
        paint: {
          ...block.paint,
          background: {
            ...block.paint.background,
            image: key,
            size:
              style.backgroundSize === "auto auto"
                ? "auto"
                : (style.backgroundSize as "auto" | "cover" | "contain"),
            repeat:
              style.backgroundRepeat === "no-repeat" ? "no-repeat" : "repeat",
            position: {
              x: position(style.backgroundPositionX),
              y: position(style.backgroundPositionY),
            },
          },
        },
      });
    } else if (style.display === "inline") {
      for (const fragment of Array.from(node.getClientRects()))
        commands.push(readBlock(style, geometry.rect(fragment)));
    } else commands.push(block);
    const clipped =
      style.overflowX !== "visible" || style.overflowY !== "visible";
    if (clipped) {
      const radius =
        block.paint.radius?.px ?? block.paint.radius?.corners?.[0] ?? 0;
      commands.push({
        kind: "clipRect",
        rect,
        radius: { rx: radius, ry: radius },
      });
    }
    let raster: [string, ImageBitmap | HTMLImageElement] | null = null;
    if (node instanceof SVGSVGElement)
      raster = await resources.svg(node, rect, pixelRatio);
    else if (node instanceof HTMLImageElement)
      raster = await resources.image(node);
    else if (node instanceof HTMLCanvasElement)
      raster = await resources.canvas(node);
    if (raster) {
      const [src, image] = raster;
      images.set(src, image);
      commands.push({ kind: "pushState" }, { kind: "clipRect", rect });
      const destination =
        node instanceof HTMLImageElement ? imageRect(rect, node, style) : rect;
      commands.push(
        { kind: "paintImage", rect: destination, src },
        { kind: "popState" },
      );
    } else {
      const children = Array.from(node.childNodes);
      children.sort((a, b) => zIndex(a) - zIndex(b));
      for (const child of children) await visit(child);
    }
    commands.push({ kind: "popState" });
  };
  for (const node of Array.from(source.childNodes)) await visit(node);
  signal.throwIfAborted();
  return {
    commands,
    images,
    width: geometry.width,
    height: geometry.height,
    scrollSensitive,
  };
}

function zIndex(node: Node): number {
  return node instanceof Element ? cssPixels(getComputedStyle(node).zIndex) : 0;
}

function imageRect(
  rect: Rect,
  image: HTMLImageElement,
  style: CSSStyleDeclaration,
): Rect {
  if (style.objectFit === "fill") return rect;
  const contain = Math.min(
    rect.width / image.naturalWidth,
    rect.height / image.naturalHeight,
  );
  const scale =
    style.objectFit === "cover"
      ? Math.max(
          rect.width / image.naturalWidth,
          rect.height / image.naturalHeight,
        )
      : style.objectFit === "none"
        ? 1
        : style.objectFit === "scale-down"
          ? Math.min(1, contain)
          : contain;
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  const [x = "50%", y = "50%"] = style.objectPosition.split(" ");
  const offset = (value: string, free: number) =>
    value.endsWith("%") ? (cssPixels(value) / 100) * free : cssPixels(value);
  return {
    x: rect.x + offset(x, rect.width - width),
    y: rect.y + offset(y, rect.height - height),
    width,
    height,
  };
}
