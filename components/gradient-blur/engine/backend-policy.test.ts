import { describe, expect, it } from "vitest";
import { resolveBackend } from "./backend-policy";

const idle = {
  nativeReady: false,
  ritoReady: false,
};

describe("progressive backend enhancement", () => {
  it("starts with CSS before client capability detection", () => {
    expect(resolveBackend({ ...idle, webgl: null })).toBe("css");
  });
  it("keeps CSS when WebGL2 is unavailable", () => {
    expect(resolveBackend({ ...idle, webgl: false })).toBe("css");
  });
  it("prefers native and then Rito", () => {
    expect(
      resolveBackend({
        ...idle,
        webgl: true,
        nativeReady: true,
        ritoReady: true,
      }),
    ).toBe("html-in-canvas");
    expect(resolveBackend({ ...idle, webgl: true, ritoReady: true })).toBe(
      "rito",
    );
  });
  it("keeps CSS until a surface is ready, including renderer failures", () => {
    expect(resolveBackend({ ...idle, webgl: true })).toBe("css");
  });
  it("returns to CSS after losing the active surface", () => {
    const state = { ...idle, webgl: true, ritoReady: true };
    expect(resolveBackend(state)).toBe("rito");
    expect(resolveBackend({ ...state, ritoReady: false })).toBe("css");
  });
  it("requires WebGL2 support before accepting a ready surface", () => {
    expect(resolveBackend({ ...idle, webgl: false, ritoReady: true })).toBe(
      "css",
    );
  });
});
