import type { GradientBlurActiveBackend } from "../types";

interface BackendState {
  webgl: boolean | null;
  nativeReady: boolean;
  ritoReady: boolean;
}

export function resolveBackend(state: BackendState): GradientBlurActiveBackend {
  if (state.webgl !== true) return "css";
  if (state.nativeReady) return "html-in-canvas";
  if (state.ritoReady) return "rito";
  return "css";
}
