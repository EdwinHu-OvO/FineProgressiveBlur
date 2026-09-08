import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FrameQueue } from "./frame-queue";

const frames = new Map<number, FrameRequestCallback>();
let frameId = 0;
beforeEach(() => {
  frames.clear();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
});
afterEach(() => vi.unstubAllGlobals());
async function frame(timestamp: number) {
  const callbacks = [...frames.values()];
  frames.clear();
  for (const callback of callbacks) callback(timestamp);
  await Promise.resolve();
}

describe("Rito frame queue", () => {
  it("stays idle and accepts updates on consecutive high-refresh frames", async () => {
    const render = vi.fn(async () => {});
    const queue = new FrameQueue(render, vi.fn());
    expect(frames.size).toBe(0);
    for (const timestamp of [0, 4, 8, 12]) {
      queue.request();
      await frame(timestamp);
    }
    expect(render).toHaveBeenCalledTimes(4);
    expect(frames.size).toBe(0);
    queue.dispose();
  });
  it("coalesces pending work without losing a content change during an async frame", async () => {
    let finish!: () => void;
    const first = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const render = vi
      .fn()
      .mockImplementationOnce(() => first)
      .mockResolvedValue(undefined);
    const queue = new FrameQueue(render, vi.fn());
    queue.request();
    await frame(0);
    queue.request(true);
    queue.request(false);
    queue.request(false);
    expect(frames.size).toBe(0);
    finish();
    await first;
    await Promise.resolve();
    await frame(4);
    expect(render).toHaveBeenCalledTimes(2);
    expect(render.mock.calls[1][0]).toBe(true);
    queue.dispose();
  });
  it("aborts in-flight work and drops queued work on disposal", async () => {
    let signal!: AbortSignal;
    const render = vi.fn(async (_content: boolean, next: AbortSignal) => {
      signal = next;
    });
    const queue = new FrameQueue(render, vi.fn());
    queue.request(true);
    await frame(0);
    queue.request(true);
    queue.dispose();
    expect(signal.aborted).toBe(true);
    await frame(4);
    expect(render).toHaveBeenCalledTimes(1);
  });
});
