"use client";

import { useSyncExternalStore } from "react";

let available: boolean | undefined;

/** Probe once: a later renderer failure/context loss must not enable CSS. */
export function supportsWebGL2(): boolean {
  if (typeof document === "undefined") return false;
  if (available !== undefined) return available;
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    available = Boolean(gl);
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    available = false;
  }
  return available;
}

const subscribe = () => () => {};
const serverSnapshot = () => null;

export function useWebGL2Support(): boolean | null {
  return useSyncExternalStore(subscribe, supportsWebGL2, serverSnapshot);
}
