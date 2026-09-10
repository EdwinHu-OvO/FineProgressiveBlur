"use client";

import { useEffect, useMemo, useState } from "react";
import { loadBlurMask, maskAlphaUrl } from "./load-mask";
import type { BlurMask, ResolvedBlurMask } from "./types";

export function useBlurMask(mask?: BlurMask, needsFallback = true) {
  const source = typeof mask === "string" ? mask : mask?.source;
  const channel = typeof mask === "object" ? mask.channel : undefined;
  const invert = typeof mask === "object" ? mask.invert : undefined;
  const revision = typeof mask === "object" ? mask.revision : undefined;
  const request = useMemo(
    () => ({ source, channel, invert, revision, needsFallback }),
    [source, channel, invert, revision, needsFallback],
  );
  const [result, setResult] = useState<{
    request: typeof request;
    mask?: ResolvedBlurMask;
    alphaUrl?: string;
    error?: string;
  }>();
  useEffect(() => {
    if (request.source === undefined) return;
    const controller = new AbortController();
    loadBlurMask({ ...request, source: request.source }, controller.signal)
      .then((resolved) => {
        if (controller.signal.aborted) return;
        setResult({
          request,
          mask: resolved,
          alphaUrl: request.needsFallback ? maskAlphaUrl(resolved) : undefined,
        });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setResult({
            request,
            error: error instanceof Error ? error.message : String(error),
          });
      });
    return () => controller.abort();
  }, [request]);
  return result?.request === request ? result : undefined;
}
