import type { GradientBlurActiveBackend } from "../types";

interface BackendState {
  webgl: boolean | null;
  nativePending: boolean;
  nativeReady: boolean;
  ritoPending: boolean;
  ritoReady: boolean;
}

export function resolveBackend(state: BackendState): GradientBlurActiveBackend {
  if (state.webgl === null) return "pending";
  if (!state.webgl) return "css";
  if (state.nativeReady) return "html-in-canvas";
  if (state.nativePending) return "pending";
  if (state.ritoReady) return "rito";
  return state.ritoPending ? "pending" : "unavailable";
}
