import { useEffect, useRef, useState } from "react";
import { COMPARISON_IMAGE, paintComparisonImage } from "./image-source";
import { UniformImageRenderer } from "./UniformImageRenderer";
import type { GradientBlurAlgorithm } from "@/components/gradient-blur";

type ComparisonStatus =
  "loading" | "ready" | "webgl-unavailable" | "image-error";

export function useImageComparison(
  radius: number,
  algorithm: GradientBlurAlgorithm,
) {
  const sourceRef = useRef<HTMLCanvasElement>(null);
  const outputRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<UniformImageRenderer | null>(null);
  const radiusRef = useRef(radius);
  const algorithmRef = useRef(algorithm);
  const [status, setStatus] = useState<ComparisonStatus>("loading");

  useEffect(() => {
    radiusRef.current = radius;
    algorithmRef.current = algorithm;
    rendererRef.current?.render(radius, algorithm);
  }, [radius, algorithm]);

  useEffect(() => {
    const source = sourceRef.current;
    const output = outputRef.current;
    if (!source || !output) return;
    const image = new Image();
    let active = true;
    let decoded = false;
    let lastSize = "";

    const releaseRenderer = () => {
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
    const createRenderer = () => {
      releaseRenderer();
      try {
        rendererRef.current = new UniformImageRenderer(output);
      } catch {
        rendererRef.current = null;
      }
    };
    const resize = () => {
      if (!active || !decoded) return;
      const { width, height } = source.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const size = `${width}:${height}:${pixelRatio}`;
      if (width <= 0 || height <= 0 || size === lastSize) return;
      try {
        paintComparisonImage(source, image, width, height, pixelRatio);
      } catch {
        setStatus("image-error");
        return;
      }
      lastSize = size;
      try {
        rendererRef.current?.setSource(source, width, height, pixelRatio);
        rendererRef.current?.render(radiusRef.current, algorithmRef.current);
      } catch {
        releaseRenderer();
      }
      setStatus(rendererRef.current ? "ready" : "webgl-unavailable");
    };
    const onContextLost = (event: Event) => {
      event.preventDefault();
      releaseRenderer();
      setStatus("webgl-unavailable");
    };
    const onContextRestored = () => {
      createRenderer();
      lastSize = "";
      resize();
    };

    output.addEventListener("webglcontextlost", onContextLost);
    output.addEventListener("webglcontextrestored", onContextRestored);
    const observer = new ResizeObserver(resize);
    observer.observe(source);
    window.addEventListener("resize", resize);
    image.src = COMPARISON_IMAGE;
    void image
      .decode()
      .then(() => {
        if (!active) return;
        decoded = true;
        createRenderer();
        resize();
      })
      .catch(() => {
        if (active) setStatus("image-error");
      });

    return () => {
      active = false;
      observer.disconnect();
      window.removeEventListener("resize", resize);
      output.removeEventListener("webglcontextlost", onContextLost);
      output.removeEventListener("webglcontextrestored", onContextRestored);
      releaseRenderer();
    };
  }, []);

  return { sourceRef, outputRef, status };
}
