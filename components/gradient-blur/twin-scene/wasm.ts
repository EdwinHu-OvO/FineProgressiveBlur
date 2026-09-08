import type { TwinWasmExports } from "./types";

interface TwinSceneWasmModule {
  default(
    input?: RequestInfo | URL | Response | BufferSource,
  ): Promise<unknown>;
  TwinSceneKernel?: TwinWasmExports["TwinSceneKernel"];
  layout_and_clip_json(input: string): string;
}

/** Loads generated wasm-bindgen web glue at runtime from the public asset path. */
export async function loadTwinSceneWasm(): Promise<TwinWasmExports> {
  if (typeof document === "undefined") {
    throw new Error("The twin scene WASM kernel only runs in a browser");
  }
  const moduleUrl = new URL(
    "wasm/twin-scene/twin_scene_kernel.js",
    document.baseURI,
  ).href;
  const wasmModule = (await import(moduleUrl)) as TwinSceneWasmModule;
  await wasmModule.default();
  return {
    TwinSceneKernel: wasmModule.TwinSceneKernel,
    layout_and_clip_json: wasmModule.layout_and_clip_json,
  };
}
