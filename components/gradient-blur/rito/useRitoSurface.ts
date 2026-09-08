"use client";

import {
  useLayoutEffect,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";
import { RitoSurface } from "./rito-surface";

interface SurfaceState {
  surface: RitoSurface | null;
  pending: boolean;
}
const INITIAL: SurfaceState = { surface: null, pending: true };
class SurfaceStore {
  private value = INITIAL;
  private readonly listeners = new Set<() => void>();
  getSnapshot = () => this.value;
  getServerSnapshot = () => INITIAL;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  set(surface: RitoSurface | null, pending = false) {
    this.value = { surface, pending };
    for (const listener of this.listeners) listener();
  }
}

interface SurfaceOptions {
  enabled: boolean;
  providerRef: RefObject<HTMLDivElement | null>;
  resolveSource(): HTMLElement | null;
  maxPixelRatio: number;
  refreshKey: string;
}

export function useRitoSurface({
  enabled,
  providerRef,
  resolveSource,
  maxPixelRatio,
  refreshKey,
}: SurfaceOptions): SurfaceState {
  const [store] = useState(() => new SurfaceStore());
  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
  useLayoutEffect(() => {
    if (!enabled) {
      store.set(null);
      return;
    }
    const provider = providerRef.current;
    const source = resolveSource();
    if (
      !provider ||
      !source ||
      source === provider ||
      !provider.contains(source)
    ) {
      store.set(null);
      return;
    }
    store.set(null, true);
    delete provider.dataset.ritoError;
    let surface: RitoSurface | null = null;
    const failure = (error: unknown) => {
      provider.dataset.ritoError =
        error instanceof Error ? error.message : String(error);
      store.set(null);
    };
    try {
      surface = new RitoSurface({
        provider,
        source,
        maxPixelRatio,
        onReady: (value) => store.set(value),
        onFailure: failure,
      });
    } catch (error) {
      failure(error);
    }
    return () => {
      surface?.dispose();
      store.set(null, true);
    };
  }, [enabled, providerRef, resolveSource, maxPixelRatio, refreshKey, store]);
  return state;
}
