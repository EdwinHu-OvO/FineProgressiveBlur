"use client";

import { useState } from "react";
import {
  runGpuBlurBenchmark,
  type GpuBlurBenchmarkResult,
} from "./gpu-blur-benchmark";

export function GpuBlurBenchmark() {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GpuBlurBenchmarkResult | null>(null);

  const run = async () => {
    setRunning(true);
    setError(null);
    try {
      setResult(await runGpuBlurBenchmark());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setRunning(false);
    }
  };

  const download = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: "application/json",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "fine-progressive-blur-gpu-benchmark.json";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: "0 24px" }}>
      <h1>GPU 模糊基准</h1>
      <p>
        优先使用 WebGL2 timer query 测量生产渲染器的 GPU 时间。设备未提供可选扩展时，
        自动改用包含 GPU 完成等待的墙钟时间；每个配置预热 5 次，采样 15 次。
      </p>
      <button type="button" disabled={running} onClick={run}>
        {running ? "测量中…" : "开始测量"}
      </button>{" "}
      <button type="button" disabled={!result} onClick={download}>
        下载 JSON
      </button>
      {error && <p role="alert">{error}</p>}
      {result && (
        <>
          <p>GPU：{result.renderer}</p>
          <p>
            计时：{result.timing === "gpu" ? "GPU timer query" : "墙钟（含 GPU 完成）"}
          </p>
          <table>
            <thead>
              <tr>
                <th>算法</th><th>半径</th><th>DPR</th><th>中位数 GPU ms</th>
                <th>P10–P90 GPU ms</th><th>相对收益</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => {
                const baseline = result.rows.find(
                  (candidate) =>
                    candidate.algorithm === "compact9" &&
                    candidate.radius === row.radius &&
                    candidate.pixelRatio === row.pixelRatio,
                );
                const gain = baseline
                  ? `${((1 - row.medianGpuMs / baseline.medianGpuMs) * 100).toFixed(1)}%`
                  : "—";
                return (
                  <tr key={`${row.algorithm}-${row.radius}-${row.pixelRatio}`}>
                    <td>{row.algorithm}</td><td>{row.radius}px</td><td>{row.pixelRatio}</td>
                    <td>{row.medianGpuMs.toFixed(3)}</td>
                    <td>{row.p10GpuMs.toFixed(3)}–{row.p90GpuMs.toFixed(3)}</td>
                    <td>{gain}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}
