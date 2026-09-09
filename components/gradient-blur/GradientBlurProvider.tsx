"use client";

import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { useWebGL2Support } from "./engine/webgl-support";
import { resolveBackend } from "./engine/backend-policy";
import { useNativeSurface } from "./native/useNativeSurface";
import { useRitoSurface } from "./rito/useRitoSurface";
import type { BlurSurface } from "./engine/blur-surface";
import type {
  GradientBlurActiveBackend,
  GradientBlurProviderHandle,
  GradientBlurProviderProps,
  GradientBlurBezier,
} from "./types";

interface GradientBlurContextValue {
  activeBackend: GradientBlurActiveBackend;
  surface: BlurSurface | null;
  fallback: "css" | "transparent";
  algorithm: import("./types").GradientBlurAlgorithm;
  blurCurve?: GradientBlurBezier;
}

const GradientBlurContext = createContext<GradientBlurContextValue | null>(
  null,
);

function findCaptureSource(provider: HTMLDivElement): HTMLElement {
  const explicit = provider.querySelector<HTMLElement>(
    ":scope > [data-gradient-blur-source]",
  );
  if (explicit) return explicit;

  const child = Array.from(provider.children).find(
    (element) =>
      !element.hasAttribute("data-gradient-blur-overlay") &&
      !element.hasAttribute("data-gradient-blur-rito"),
  );
  return child instanceof HTMLElement ? child : provider;
}

export const GradientBlurProvider = forwardRef<
  GradientBlurProviderHandle,
  GradientBlurProviderProps
>(function GradientBlurProvider(
  {
    captureBackend = "auto",
    algorithm = "compact9",
    blurCurve,
    children,
    fallback = "css",
    maxDevicePixelRatio = 2,
    onBackendChange,
    sourceRef,
    style,
    ...providerProps
  },
  forwardedRef,
) {
  const providerRef = useRef<HTMLDivElement>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);

  const resolveSource = useCallback(() => {
    if (sourceRef?.current) return sourceRef.current;
    return providerRef.current ? findCaptureSource(providerRef.current) : null;
  }, [sourceRef]);

  const webgl = useWebGL2Support();
  const enableNative = webgl === true && captureBackend !== "rito";
  const native = useNativeSurface({
    providerRef,
    enabled: enableNative,
    resolveSource,
    maxPixelRatio: Math.min(3, Math.max(1, maxDevicePixelRatio)),
    refreshKey: `${captureBackend}:${refreshVersion}`,
  });
  const nativeSurface = enableNative ? native.surface : null;
  const nativePending = enableNative && native.pending;
  const enableRito =
    webgl === true &&
    (captureBackend === "auto" || captureBackend === "rito") &&
    !nativePending &&
    !nativeSurface;
  const rito = useRitoSurface({
    providerRef,
    enabled: enableRito,
    resolveSource,
    maxPixelRatio: Math.min(3, Math.max(1, maxDevicePixelRatio)),
    refreshKey: `${captureBackend}:${refreshVersion}`,
  });
  const ritoSurface = enableRito ? rito.surface : null;
  const surface = nativeSurface ?? ritoSurface;
  const refresh = useCallback(() => {
    if (surface) surface.request("manual");
    else setRefreshVersion((version) => version + 1);
  }, [surface]);
  useImperativeHandle(forwardedRef, () => ({ refresh }), [refresh]);
  const activeBackend = resolveBackend({
    webgl,
    nativeReady: Boolean(nativeSurface),
    ritoReady: Boolean(ritoSurface),
  });
  const backendCallback = useRef(onBackendChange);
  useEffect(() => {
    backendCallback.current = onBackendChange;
  }, [onBackendChange]);
  useEffect(() => {
    backendCallback.current?.(activeBackend);
  }, [activeBackend]);

  const context = useMemo<GradientBlurContextValue>(
    () => ({
      activeBackend,
      surface,
      fallback,
      algorithm,
      blurCurve,
    }),
    [activeBackend, surface, fallback, algorithm, blurCurve],
  );

  return (
    <GradientBlurContext value={context}>
      <div
        {...providerProps}
        ref={providerRef}
        data-gradient-blur-provider=""
        data-requested-backend={captureBackend}
        data-capture-backend={activeBackend}
        style={{
          ...style,
          isolation: "isolate",
          position: style?.position ?? "relative",
        }}
      >
        {children}
      </div>
    </GradientBlurContext>
  );
});

export function useGradientBlurContext(): GradientBlurContextValue {
  const context = useContext(GradientBlurContext);
  if (!context) {
    throw new Error("GradientBlurOverlay must be inside GradientBlurProvider");
  }
  return context;
}
