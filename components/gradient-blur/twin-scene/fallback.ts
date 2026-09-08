import type {
  TwinSceneKernel,
  TwinSceneNode,
  TwinVisibleBuffer,
  TwinViewport,
  TwinVisibleNode,
} from "./types";
import { TWIN_VISIBLE_STRIDE } from "./types";

function intersect(
  node: TwinSceneNode,
  viewport: TwinViewport,
): TwinVisibleNode | null {
  const x = node.rect.x - viewport.scrollX;
  const y = node.rect.y - viewport.scrollY;
  const left = Math.max(0, x);
  const top = Math.max(0, y);
  const right = Math.min(viewport.width, x + node.rect.width);
  const bottom = Math.min(viewport.height, y + node.rect.height);
  if (right <= left || bottom <= top) return null;
  return {
    ...node,
    rect: { x: left, y: top, width: right - left, height: bottom - top },
    index: -1,
  };
}

export const fallbackTwinSceneKernel: TwinSceneKernel = {
  backend: "typescript",
  createLayout(nodes) {
    const output = new Float32Array(nodes.length * TWIN_VISIBLE_STRIDE);
    return {
      backend: "typescript",
      dispose() {},
      layoutAndClip(viewport): TwinVisibleBuffer {
        let count = 0;
        nodes.forEach((node, index) => {
          const visible = intersect(node, viewport);
          if (!visible) return;
          const offset = count * TWIN_VISIBLE_STRIDE;
          output[offset] = index;
          output[offset + 1] = nodeKindCode(node.kind);
          output[offset + 2] = visible.rect.x;
          output[offset + 3] = visible.rect.y;
          output[offset + 4] = visible.rect.width;
          output[offset + 5] = visible.rect.height;
          count += 1;
        });
        return { count, data: output };
      },
    };
  },
  layoutAndClip(nodes, viewport) {
    return nodes.flatMap((node, index) => {
      const visible = intersect(node, viewport);
      return visible ? [{ ...visible, index }] : [];
    });
  },
};

function nodeKindCode(kind: TwinSceneNode["kind"]): number {
  if (kind === "image") return 1;
  if (kind === "rect") return 2;
  return 0;
}
