import { describe, expect, it } from "vitest";
import { resolveBackend } from "./backend-policy";

const idle = {
  nativePending: false,
  nativeReady: false,
  ritoPending: false,
  ritoReady: false,
};

describe("backend fallback policy", () => {
  it("waits for capability detection before rendering any fallback", () => {
    expect(resolveBackend({ ...idle, webgl: null })).toBe("pending");
  });
  it("uses CSS only when WebGL2 is unavailable", () => {
    expect(resolveBackend({ ...idle, webgl: false })).toBe("css");
  });
  it("prefers native and then Rito", () => {
    expect(resolveBackend({ ...idle, webgl: true, nativePending: true })).toBe(
      "pending",
    );
    expect(
      resolveBackend({
        ...idle,
        webgl: true,
        nativeReady: true,
        ritoReady: true,
      }),
    ).toBe("html-in-canvas");
    expect(resolveBackend({ ...idle, webgl: true, ritoPending: true })).toBe(
      "pending",
    );
    expect(resolveBackend({ ...idle, webgl: true, ritoReady: true })).toBe(
      "rito",
    );
  });
  it("does not use CSS for renderer failures on a WebGL2 device", () => {
    expect(resolveBackend({ ...idle, webgl: true })).toBe("unavailable");
  });
});
