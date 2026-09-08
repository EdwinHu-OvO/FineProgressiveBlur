import type { Rect } from "./vendor/frame-types";

/** All retained drawing and selection coordinates are in source-content CSS px. */
export class DomGeometry {
  readonly bounds: DOMRect;
  readonly width: number;
  readonly height: number;
  constructor(readonly source: HTMLElement) {
    this.bounds = source.getBoundingClientRect();
    this.width = Math.max(source.scrollWidth, source.clientWidth, 1);
    this.height = Math.max(source.scrollHeight, source.clientHeight, 1);
  }

  rect(rect: DOMRect): Rect {
    return {
      x:
        rect.left -
        this.bounds.left -
        this.source.clientLeft +
        this.source.scrollLeft,
      y:
        rect.top -
        this.bounds.top -
        this.source.clientTop +
        this.source.scrollTop,
      width: rect.width,
      height: rect.height,
    };
  }
}

export function cssPixels(value: string): number {
  return Number.parseFloat(value) || 0;
}

export function splitCssList(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  let quote = "";
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if (quote) {
      if (char === quote && value[i - 1] !== "\\") quote = "";
    } else if (char === '"' || char === "'") quote = char;
    else if (char === "(") depth += 1;
    else if (char === ")") depth -= 1;
    else if (char === "," && depth === 0) {
      parts.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(value.slice(start).trim());
  return parts;
}

export function readShadows(value: string) {
  if (value === "none") return [];
  return splitCssList(value).map((layer) => {
    const color =
      layer.match(/(?:rgba?|hsla?|color)\([^)]*\)|#[\da-f]+/i)?.[0] ?? "black";
    const lengths = layer
      .replace(color, "")
      .replace(/inset/g, "")
      .trim()
      .split(/\s+/)
      .map(cssPixels);
    return {
      color,
      offsetX: lengths[0] ?? 0,
      offsetY: lengths[1] ?? 0,
      blur: lengths[2] ?? 0,
      spread: lengths[3] ?? 0,
      inset: layer.includes("inset"),
    };
  });
}
