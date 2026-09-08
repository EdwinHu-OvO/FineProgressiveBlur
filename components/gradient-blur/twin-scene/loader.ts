import { fallbackTwinSceneKernel } from "./fallback";
import type {
  TwinSceneKernel,
  TwinSceneNode,
  TwinSceneLayout,
  TwinViewport,
  TwinVisibleNode,
  TwinWasmExports,
} from "./types";
import { TWIN_NODE_STRIDE, TWIN_VISIBLE_STRIDE } from "./types";

export interface TwinWasmLoaderOptions {
  /**
   * Inject generated wasm-bindgen glue. Keeping this as a factory avoids a
   * bundler/SSR dependency until the optional artifact is actually enabled.
   */
  loadWasm?: () => Promise<TwinWasmExports>;
}

const kernelPromises = new WeakMap<
  NonNullable<TwinWasmLoaderOptions["loadWasm"]>,
  Promise<TwinSceneKernel>
>();

export function loadTwinSceneKernel(
  options: TwinWasmLoaderOptions = {},
): Promise<TwinSceneKernel> {
  const loadWasm = options.loadWasm;
  if (typeof WebAssembly === "undefined" || !loadWasm) {
    return Promise.resolve(fallbackTwinSceneKernel);
  }

  const cached = kernelPromises.get(loadWasm);
  if (cached) return cached;
  const kernelPromise = loadWasm()
    .then((wasm) => createWasmKernel(wasm))
    .catch(() => fallbackTwinSceneKernel);
  kernelPromises.set(loadWasm, kernelPromise);
  return kernelPromise;
}

function createWasmKernel(wasm: TwinWasmExports): TwinSceneKernel {
  if (wasm.TwinSceneKernel) {
    return createPackedWasmKernel(wasm.TwinSceneKernel);
  }
  return {
    backend: "wasm",
    createLayout(nodes) {
      return fallbackTwinSceneKernel.createLayout(nodes);
    },
    layoutAndClip(nodes: readonly TwinSceneNode[], viewport: TwinViewport) {
      const input = JSON.stringify({
        nodes: nodes.map(({ kind, rect }) => ({ kind, ...rect })),
        viewport: {
          width: viewport.width,
          height: viewport.height,
          scroll_x: viewport.scrollX,
          scroll_y: viewport.scrollY,
        },
      });
      return JSON.parse(wasm.layout_and_clip_json(input)) as TwinVisibleNode[];
    },
  };
}

function createPackedWasmKernel(
  Kernel: NonNullable<TwinWasmExports["TwinSceneKernel"]>,
): TwinSceneKernel {
  return {
    backend: "wasm",
    createLayout(nodes) {
      return createPackedWasmLayout(Kernel, nodes);
    },
    layoutAndClip(nodes, viewport) {
      const layout = createPackedWasmLayout(Kernel, nodes);
      const visible = layout.layoutAndClip(viewport);
      const result = unpackVisibleNodes(nodes, visible.data, visible.count);
      layout.dispose();
      return result;
    },
  };
}

function createPackedWasmLayout(
  Kernel: NonNullable<TwinWasmExports["TwinSceneKernel"]>,
  nodes: readonly TwinSceneNode[],
): TwinSceneLayout {
  const instance = new Kernel();
  const packedNodes = new Float32Array(nodes.length * TWIN_NODE_STRIDE);
  nodes.forEach((node, index) => {
    const offset = index * TWIN_NODE_STRIDE;
    packedNodes[offset] =
      node.kind === "image" ? 1 : node.kind === "rect" ? 2 : 0;
    packedNodes[offset + 1] = node.rect.x;
    packedNodes[offset + 2] = node.rect.y;
    packedNodes[offset + 3] = node.rect.width;
    packedNodes[offset + 4] = node.rect.height;
  });
  instance.set_scene(packedNodes);
  const output = new Float32Array(nodes.length * TWIN_VISIBLE_STRIDE);
  return {
    backend: "wasm",
    dispose: () => instance.free(),
    layoutAndClip(viewport) {
      const count = instance.layout_and_clip_into(
        viewport.width,
        viewport.height,
        viewport.scrollX,
        viewport.scrollY,
        output,
      );
      return { count, data: output };
    },
  };
}

function unpackVisibleNodes(
  nodes: readonly TwinSceneNode[],
  output: Float32Array,
  count: number,
): TwinVisibleNode[] {
  return Array.from({ length: count }, (_, visibleIndex) => {
    const offset = visibleIndex * TWIN_VISIBLE_STRIDE;
    const index = output[offset];
    return {
      ...nodes[index],
      index,
      rect: {
        x: output[offset + 2],
        y: output[offset + 3],
        width: output[offset + 4],
        height: output[offset + 5],
      },
    };
  });
}
