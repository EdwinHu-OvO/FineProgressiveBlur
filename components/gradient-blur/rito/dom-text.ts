import type { CoreFrameCommand, RunPaint } from "./vendor/frame-types";
import { buildFontString } from "./vendor/canvas-text/font-string";
import { DomGeometry, cssPixels, readShadows } from "./dom-geometry";

interface TextLine {
  text: string;
  rect: DOMRect;
}
const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** Browser ranges own wrapping and shaping boundaries; Rito owns the paint. */
export function readText(
  node: Text,
  geometry: DomGeometry,
  ctx: CanvasRenderingContext2D,
): CoreFrameCommand[] {
  const parent = node.parentElement;
  if (!parent || !node.data.trim()) return [];
  const style = getComputedStyle(parent);
  if (style.visibility !== "visible") return [];
  if (style.direction === "rtl")
    throw new Error("Rito: bidirectional DOM text is not supported");
  const paint: RunPaint = {
    color: style.color,
    font: {
      family: style.fontFamily,
      sizePx: cssPixels(style.fontSize),
      style: style.fontStyle === "italic" ? "italic" : "normal",
      weight: cssPixels(style.fontWeight) || 400,
    },
    letterSpacingPx: cssPixels(style.letterSpacing),
    wordSpacingPx: cssPixels(style.wordSpacing),
    textShadow: readShadows(style.textShadow),
  };
  ctx.font = buildFontString(paint.font);
  const metrics = ctx.measureText(node.data.trim());
  const ascent = metrics.fontBoundingBoxAscent;
  const descent = metrics.fontBoundingBoxDescent;
  const lines: TextLine[] = [];
  const range = document.createRange();
  const collapse = !["pre", "pre-wrap", "break-spaces"].includes(
    style.whiteSpace,
  );
  // Justified words need their measured positions; a whole fillText loses the gaps.
  const justified = style.textAlign === "justify";
  for (const { segment, index } of graphemes.segment(node.data)) {
    range.setStart(node, index);
    range.setEnd(node, index + segment.length);
    const box = Array.from(range.getClientRects()).find(
      (rect) => rect.width > 0 && rect.height > 0,
    );
    if (!box) continue;
    const text = collapse && /^\s+$/.test(segment) ? " " : segment;
    const line = lines.at(-1);
    if (
      line &&
      Math.abs(line.rect.top - box.top) < 0.5 &&
      Math.abs(line.rect.bottom - box.bottom) < 0.5 &&
      !justified
    ) {
      if (!(collapse && text === " " && line.text.endsWith(" ")))
        line.text += text;
      line.rect = new DOMRect(
        Math.min(line.rect.left, box.left),
        box.top,
        Math.max(line.rect.right, box.right) -
          Math.min(line.rect.left, box.left),
        box.height,
      );
    } else lines.push({ text, rect: box });
  }
  return lines
    .filter((line) => line.text.trim())
    .map((line) => {
      const rect = geometry.rect(line.rect);
      // Rito encodes baseline as em-top + .8em. DOM Range gives the font envelope.
      const baseline = rect.y + (rect.height - ascent - descent) / 2 + ascent;
      const y = baseline - 0.8 * paint.font.sizePx;
      let text = line.text;
      if (style.textTransform === "uppercase") text = text.toLocaleUpperCase();
      if (style.textTransform === "lowercase") text = text.toLocaleLowerCase();
      if (style.textTransform === "capitalize")
        text = text.replace(/\b\p{L}/gu, (letter) =>
          letter.toLocaleUpperCase(),
        );
      const decoration = style.textDecorationLine.includes("underline")
        ? "underline"
        : style.textDecorationLine.includes("line-through")
          ? "line-through"
          : null;
      return {
        kind: "paintText",
        text,
        rect: { ...rect, y },
        paint: {
          ...paint,
          ...(decoration
            ? {
                decoration: {
                  kind: decoration,
                  color: style.textDecorationColor,
                  thickness:
                    cssPixels(style.textDecorationThickness) ||
                    Math.max(1, paint.font.sizePx / 16),
                  y:
                    0.8 * paint.font.sizePx +
                    (decoration === "underline"
                      ? cssPixels(style.textUnderlineOffset) || 2
                      : -paint.font.sizePx * 0.3),
                },
              }
            : {}),
        },
      };
    });
}
