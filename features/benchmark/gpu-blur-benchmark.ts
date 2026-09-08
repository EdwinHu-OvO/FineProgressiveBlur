import { createAtlasLayout } from "@/components/gradient-blur/engine/atlas-layout";
import { CanvasTexture } from "@/components/gradient-blur/engine/canvas-texture";
import { GradientBlurRenderer } from "@/components/gradient-blur/engine/GradientBlurRenderer";
import type { GradientBlurAlgorithm } from "@/components/gradient-blur";

export interface GpuBlurBenchmarkOptions {
  radii?: readonly number[];
  pixelRatios?: readonly number[];
  warmup?: number;
  samples?: number;
}

export interface GpuBlurBenchmarkRow {
  algorithm: GradientBlurAlgorithm;
  radius: number;
  pixelRatio: number;
  medianGpuMs: number;
  p10GpuMs: number;
  p90GpuMs: number;
  samples: number;
}

export interface GpuBlurBenchmarkResult {
  generatedAt: string;
  renderer: string;
  timing: "gpu" | "wall-clock";
  extension: string | null;
  rows: GpuBlurBenchmarkRow[];
}

interface TimerExtension {
  TIME_ELAPSED_EXT: number;
  GPU_DISJOINT_EXT: number;
}

const DEFAULT_RADII = [4, 12, 28, 48];
const DEFAULT_RATIOS = [1, 2];

/** Measures production GradientBlurRenderer GPU passes with disjoint timer queries. */
export async function runGpuBlurBenchmark(
  options: GpuBlurBenchmarkOptions = {},
): Promise<GpuBlurBenchmarkResult> {
  const output = document.createElement("canvas");
  const gl = output.getContext("webgl2", {
    alpha: true,
    antialias: false,
    depth: false,
    preserveDrawingBuffer: false,
    stencil: false,
  });
  if (!gl) throw new Error("WebGL2 is unavailable");
  const extension = gl.getExtension("EXT_disjoint_timer_query_webgl2") as
    | TimerExtension
    | null;

  const sourceCanvas = document.createElement("canvas");
  const source = new CanvasTexture(gl);
  const rows: GpuBlurBenchmarkRow[] = [];
  try {
    for (const pixelRatio of options.pixelRatios ?? DEFAULT_RATIOS) {
      const width = 640;
      const height = 360;
      sourceCanvas.width = width * pixelRatio;
      sourceCanvas.height = height * pixelRatio;
      paintBenchmarkSource(sourceCanvas, pixelRatio);
      source.upload(sourceCanvas);
      for (const radius of options.radii ?? DEFAULT_RADII) {
        const atlas = createAtlasLayout(
          sourceCanvas.width,
          sourceCanvas.height,
          radius,
          pixelRatio,
        );
        for (const algorithm of ["compact9"] as const) {
          const renderer = new GradientBlurRenderer(output, gl);
          renderer.resize(width, height, pixelRatio);
          renderer.uploadGpuAtlas(
            source.framebuffer,
            {
              x: 0,
              y: 0,
              width: sourceCanvas.width,
              height: sourceCanvas.height,
            },
            atlas,
            { direction: "top", maxRadius: radius, algorithm },
            { width, height },
          );
          try {
            for (let index = 0; index < (options.warmup ?? 5); index += 1) {
              renderer.render({
                direction: "top",
                maxRadius: radius,
                algorithm,
              });
            }
            gl.finish();
            const times: number[] = [];
            for (let index = 0; index < (options.samples ?? 15); index += 1) {
              renderer.uploadGpuAtlas(
                source.framebuffer,
                {
                  x: 0,
                  y: 0,
                  width: sourceCanvas.width,
                  height: sourceCanvas.height,
                },
                atlas,
                { direction: "top", maxRadius: radius, algorithm },
                { width, height },
              );
              gl.finish();
              times.push(
                extension
                  ? await measureGpuRender(gl, extension, renderer, radius, algorithm)
                  : measureWallClockRender(gl, renderer, radius, algorithm),
              );
            }
            times.sort((a, b) => a - b);
            rows.push({
              algorithm,
              radius,
              pixelRatio,
              medianGpuMs: times[Math.floor(times.length / 2)],
              p10GpuMs: percentile(times, 0.1),
              p90GpuMs: percentile(times, 0.9),
              samples: times.length,
            });
          } finally {
            renderer.dispose();
          }
        }
      }
    }
  } finally {
    source.dispose();
  }
  return {
    generatedAt: new Date().toISOString(),
    renderer: String(gl.getParameter(gl.RENDERER)),
    timing: extension ? "gpu" : "wall-clock",
    extension: extension ? "EXT_disjoint_timer_query_webgl2" : null,
    rows,
  };
}

function percentile(values: readonly number[], fraction: number): number {
  const position = (values.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return values[lower] ?? 0;
  return (values[lower] ?? 0) +
    ((values[upper] ?? 0) - (values[lower] ?? 0)) * (position - lower);
}

async function measureGpuRender(
  gl: WebGL2RenderingContext,
  extension: TimerExtension,
  renderer: GradientBlurRenderer,
  radius: number,
  algorithm: GradientBlurAlgorithm,
): Promise<number> {
  const query = gl.createQuery();
  if (!query) throw new Error("Unable to create GPU timer query");
  gl.beginQuery(extension.TIME_ELAPSED_EXT, query);
  renderer.render({
    direction: "top",
    maxRadius: radius,
    algorithm,
  });
  gl.endQuery(extension.TIME_ELAPSED_EXT);
  try {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      if (gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) {
        if (gl.getParameter(extension.GPU_DISJOINT_EXT))
          throw new Error("GPU timer query was disjoint");
        return Number(gl.getQueryParameter(query, gl.QUERY_RESULT)) / 1e6;
      }
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
  } finally {
    gl.deleteQuery(query);
  }
  throw new Error("Timed out waiting for GPU timer query");
}

/** Timer queries are optional on WebGL2; finish() still gives a useful portable sample. */
function measureWallClockRender(
  gl: WebGL2RenderingContext,
  renderer: GradientBlurRenderer,
  radius: number,
  algorithm: GradientBlurAlgorithm,
): number {
  const startedAt = performance.now();
  renderer.render({
    direction: "top",
    maxRadius: radius,
    algorithm,
  });
  gl.finish();
  return performance.now() - startedAt;
}

function paintBenchmarkSource(canvas: HTMLCanvasElement, pixelRatio: number): void {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D is unavailable");
  context.scale(pixelRatio, pixelRatio);
  const gradient = context.createLinearGradient(0, 0, 640, 360);
  gradient.addColorStop(0, "#172033");
  gradient.addColorStop(0.5, "#90a8ca");
  gradient.addColorStop(1, "#e2e8f2");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 640, 360);
  context.fillStyle = "rgba(255,255,255,.9)";
  context.font = "600 42px system-ui";
  context.fillText("Fine Progressive Blur", 36, 92);
  for (let x = 0; x < 640; x += 16) {
    context.fillStyle = x % 32 ? "rgba(20,35,60,.18)" : "rgba(255,255,255,.2)";
    context.fillRect(x, 150, 8, 150);
  }
}
