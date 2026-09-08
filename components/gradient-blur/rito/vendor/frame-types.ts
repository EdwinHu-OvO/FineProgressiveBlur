// SPDX-License-Identifier: AGPL-3.0-only
// Extracted from Ringyuki/Rito @ 2733ea907762d424eb0c1cb1a8b069e262c3f60a.
// Local adaptations are documented in UPSTREAM.md.

export type FrameCommand =
  | PushStateCommand
  | PopStateCommand
  | TranslateCommand
  | TransformCommand
  | OpacityCommand
  | ClipRectCommand
  | PaintPageCommand
  | PaintBlockCommand
  | PaintTextCommand
  | PaintRubyCommand
  | PaintImageCommand
  | PaintHorizontalRuleCommand;

export interface PushStateCommand {
  readonly kind: "pushState";
}

export interface PopStateCommand {
  readonly kind: "popState";
}

export interface TranslateCommand {
  readonly kind: "translate";
  readonly dx: number;
  readonly dy: number;
}

export interface TransformCommand {
  readonly kind: "transform";
  readonly origin: Point;
  readonly box: Size;
  readonly transforms: readonly TransformFn[];
}

export interface OpacityCommand {
  readonly kind: "opacity";
  readonly value: number;
}

export interface ClipRectCommand {
  readonly kind: "clipRect";
  readonly rect: Rect;
  readonly radius?: ResolvedRadius;
}

export interface PaintPageCommand {
  readonly kind: "paintPage";
  readonly rect: Rect;
  readonly paint: PagePaint;
}

export interface PaintBlockCommand {
  readonly kind: "paintBlock";
  readonly rect: Rect;
  readonly paint: BlockDecorationPaint;
  readonly borderBox?: BorderBox;
}

export interface PaintTextCommand extends TextPaintCommand {
  readonly kind: "paintText";
  readonly lineHeightPx?: number;
  readonly href?: string;
  readonly sourceText?: string;
  readonly sourceTextOffset?: number;
  /** Right-aligned draw: rect.x is the text's RIGHT edge; the renderer
   * measures the string to place the pen (outside list markers). */
  readonly alignRight?: boolean;
  /** Vertical writing: draw as one downward column, upright glyphs, the
   * pen stepping one font size per cluster; rect.x is the glyph column's
   * left edge and rect.y the first glyph's top. */
  readonly vertical?: boolean;
}

export interface PaintRubyCommand extends TextPaintCommand {
  readonly kind: "paintRuby";
  /** Non-initial ruby-align keyword; absent means space-around. */
  readonly rubyAlign?: "start" | "center" | "space-between";
  /** Vertical writing: the annotation draws as a downward column beside
   * its base; rect.x is the annotation column's left edge, rect.y the
   * base span's top, height the span to distribute over. */
  readonly vertical?: boolean;
}

export interface TextPaintCommand {
  readonly text: string;
  readonly rect: Rect;
  readonly paint: RunPaint;
}

export interface PaintImageCommand {
  readonly kind: "paintImage";
  readonly src: string;
  readonly rect: Rect;
  readonly alt?: string;
  readonly href?: string;
  /** Raster-pixel subregion to sample; absent samples the whole raster. */
  readonly sourceRect?: Rect;
}

export interface PaintHorizontalRuleCommand {
  readonly kind: "paintHorizontalRule";
  readonly rect: Rect;
  readonly paint: HorizontalRulePaint;
}

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface ResolvedRadius {
  readonly rx: number;
  readonly ry: number;
}

export type TransformFn = TranslateTransform | ScaleTransform | RotateTransform;

export interface TranslateTransform {
  readonly kind: "translate";
  readonly x: LengthPct;
  readonly y: LengthPct;
}

export interface ScaleTransform {
  readonly kind: "scale";
  readonly sx: number;
  readonly sy: number;
}

export interface RotateTransform {
  readonly kind: "rotate";
  readonly rad: number;
}

export type LengthPct =
  | { readonly unit: "px"; readonly value: number }
  | { readonly unit: "percent"; readonly value: number };

export interface PagePaint {
  readonly backgroundColor?: string;
}

export interface BlockDecorationPaint {
  readonly background?: BlockBackgroundPaint;
  readonly border?: BlockBorderPaint;
  readonly radius?: BlockRadius;
  readonly boxShadow?: readonly BoxShadow[];
}

export interface BlockBackgroundPaint {
  readonly color?: string;
  readonly image?: string;
  readonly size?: BackgroundSize;
  readonly repeat?: "repeat" | "no-repeat";
  readonly position?: BackgroundPosition;
}

export type BackgroundSize =
  "cover" | "contain" | "auto" | ExplicitBackgroundSize;

export interface ExplicitBackgroundSize {
  readonly x: BackgroundSizeAxis;
  readonly y: BackgroundSizeAxis;
}

export type BackgroundSizeAxis = "auto" | LengthPct;

export interface BackgroundPosition {
  readonly x: LengthPct;
  readonly y: LengthPct;
}

export interface BlockBorderPaint {
  readonly top?: BorderPaintEdge;
  readonly right?: BorderPaintEdge;
  readonly bottom?: BorderPaintEdge;
  readonly left?: BorderPaintEdge;
}

export interface BorderPaintEdge {
  readonly color: string;
  readonly style: "solid" | "dotted" | "dashed" | "double";
}

export interface BlockRadius {
  readonly px?: number;
  readonly pct?: number;
  /**
   * Circular corner radii in CSS order (top-left, top-right,
   * bottom-right, bottom-left) for boxes whose corners disagree.
   */
  readonly corners?: readonly [number, number, number, number];
}

export interface BoxShadow {
  readonly offsetX: number;
  readonly offsetY: number;
  readonly blur: number;
  readonly spread: number;
  readonly color: string;
  readonly inset: boolean;
}

export interface BorderBox {
  readonly topWidth: number;
  readonly rightWidth: number;
  readonly bottomWidth: number;
  readonly leftWidth: number;
}

export interface RunPaint {
  readonly color: string;
  readonly font: FontShorthand;
  readonly wordSpacingPx?: number;
  readonly letterSpacingPx?: number;
  readonly backgroundColor?: string;
  readonly backgroundRadius?: number;
  readonly textShadow?: readonly TextShadow[];
  readonly decoration?: RunDecoration;
  readonly padding?: Spacing;
  readonly border?: RunBorder;
  /** Pre-snapped vertical extent of the run's decorated inline box, as
   * offsets from the run rect's top. The layout side rounds the box to
   * device rows; the painter uses these instead of deriving the box
   * from font metrics. */
  readonly box?: RunBox;
  /** False when this run does not OPEN its inline box (the box began in
   * an earlier run of the same line); absent reads true. */
  readonly boxStart?: boolean;
  /** False when this run does not CLOSE its inline box. */
  readonly boxEnd?: boolean;
}

export interface RunBox {
  readonly topPx: number;
  readonly bottomPx: number;
}

export interface FontShorthand {
  readonly style: "normal" | "italic";
  readonly weight: number;
  readonly sizePx: number;
  readonly family: string;
}

export interface TextShadow {
  readonly offsetX: number;
  readonly offsetY: number;
  readonly blur: number;
  readonly color: string;
}

export type RunDecoration = UnderlineDecoration | LineThroughDecoration;

export interface UnderlineDecoration extends DecorationPaint {
  readonly kind: "underline";
}

export interface LineThroughDecoration extends DecorationPaint {
  readonly kind: "line-through";
}

export interface DecorationPaint {
  readonly y: number;
  readonly thickness: number;
  readonly color: string;
}

export interface Spacing {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export interface RunBorder {
  readonly top?: RunBorderEdge;
  readonly bottom?: RunBorderEdge;
  readonly start?: RunBorderEdge;
  readonly end?: RunBorderEdge;
}

export interface RunBorderEdge {
  readonly widthPx: number;
  readonly paint: BorderPaintEdge;
}

export interface HorizontalRulePaint {
  readonly color: string;
  readonly style: "solid" | "dotted" | "dashed" | "double";
}

export type CoreFrameCommand = FrameCommand;
