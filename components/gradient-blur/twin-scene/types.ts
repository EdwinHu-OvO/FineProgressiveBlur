export type TwinNodeKind = "text" | "image" | "rect";
export type TwinSceneBackend = "typescript" | "wasm";

export const TWIN_NODE_STRIDE = 5;
export const TWIN_VISIBLE_STRIDE = 6;

export interface TwinRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TwinSceneNode {
  kind: TwinNodeKind;
  rect: TwinRect;
}

export interface TwinTextNode extends TwinSceneNode {
  kind: "text";
  text: string;
  font: string;
  color: string;
  opacity: number;
  letterSpacing: number;
}

export interface TwinImageNode extends TwinSceneNode {
  kind: "image";
  image: HTMLImageElement;
  objectFit: string;
  objectPosition: string;
  borderRadius: number;
  opacity: number;
}

export interface TwinRectNode extends TwinSceneNode {
  kind: "rect";
  color: string;
  borderRadius: number;
  opacity: number;
}

export type TwinPaintNode = TwinTextNode | TwinImageNode | TwinRectNode;

export interface TwinSceneSnapshot {
  readonly nodes: readonly TwinPaintNode[];
  readonly sourceWidth: number;
  readonly sourceHeight: number;
  readonly backgroundColor: string;
}

export interface TwinViewport {
  width: number;
  height: number;
  scrollX: number;
  scrollY: number;
}

export interface TwinVisibleNode extends TwinSceneNode {
  index: number;
}

export interface TwinVisibleBuffer {
  readonly count: number;
  readonly data: Float32Array;
}

export interface TwinSceneLayout {
  readonly backend: TwinSceneBackend;
  layoutAndClip(viewport: TwinViewport): TwinVisibleBuffer;
  dispose(): void;
}

export interface TwinSceneKernel {
  readonly backend: TwinSceneBackend;
  createLayout(nodes: readonly TwinSceneNode[]): TwinSceneLayout;
  layoutAndClip(
    nodes: readonly TwinSceneNode[],
    viewport: TwinViewport,
  ): TwinVisibleNode[];
}

export interface TwinWasmKernelInstance {
  free(): void;
  set_scene(nodes: Float32Array): void;
  layout_and_clip_into(
    width: number,
    height: number,
    scrollX: number,
    scrollY: number,
    output: Float32Array,
  ): number;
}

export interface TwinWasmExports {
  TwinSceneKernel?: new () => TwinWasmKernelInstance;
  layout_and_clip_json(input: string): string;
}
