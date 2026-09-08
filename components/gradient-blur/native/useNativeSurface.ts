"use client";

import {
  useLayoutEffect,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";
import { supportsNativeCanvas } from "./html-in-canvas-api";
import { NativeSurface } from "./native-surface";

interface NativeSurfaceState {
  surface: NativeSurface | null;
  pending: boolean;
}

const INITIAL_STATE: NativeSurfaceState = { surface: null, pending: true };

class SurfaceStore {
  private value = INITIAL_STATE;
  private readonly listeners = new Set<() => void>();
  getSnapshot = () => this.value;
  getServerSnapshot = () => INITIAL_STATE;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  set(surface: NativeSurface | null, pending = false) {
    this.value = { surface, pending };
    for (const listener of this.listeners) listener();
  }
}

interface SurfaceOptions {
  providerRef: RefObject<HTMLDivElement | null>;
  enabled: boolean;
  resolveSource(): HTMLElement | null;
  maxPixelRatio: number;
  refreshKey: string;
}

export function useNativeSurface({
  providerRef,
  enabled,
  resolveSource,
  maxPixelRatio,
  refreshKey,
}: SurfaceOptions): NativeSurfaceState {
  const [store] = useState(() => new SurfaceStore());
  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
  useLayoutEffect(() => {
    const provider = providerRef.current;
    if (
      !enabled ||
      !provider ||
      !supportsNativeCanvas() ||
      resolveSource() instanceof HTMLCanvasElement ||
      !["block", "flow-root"].includes(getComputedStyle(provider).display)
    ) {
      store.set(null);
      return;
    }
    // Named slots preserve direct Overlay nodes without including them in the DOM texture.
    const nestedOverlay = Array.from(
      provider.querySelectorAll("[data-gradient-blur-overlay]"),
    ).some((element) => element.parentElement !== provider);
    if (
      nestedOverlay ||
      provider.querySelector("[data-gradient-blur-provider]")
    ) {
      store.set(null);
      return;
    }
    store.set(null, true);
    delete provider.dataset.nativeCaptureError;
    let controller: NativeSurface | null = null;
    try {
      controller = new NativeSurface({
        provider,
        resolveSource,
        maxPixelRatio,
        onReady: (value) => store.set(value),
        onFailure: (error) => {
          provider.dataset.nativeCaptureError =
            error instanceof Error ? error.message : String(error);
          store.set(null);
        },
      });
    } catch (error) {
      provider.dataset.nativeCaptureError =
        error instanceof Error ? error.message : String(error);
      store.set(null);
    }
    return () => {
      controller?.dispose();
      store.set(null, true);
    };
  }, [enabled, providerRef, resolveSource, maxPixelRatio, refreshKey, store]);

  return state;
}
