import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContentTexture } from "./content-texture";

const comparison = vi.hoisted(() => ({ differs: vi.fn(), dispose: vi.fn() }));
vi.mock("./texture-comparison", () => ({
  TextureComparison: class {
    differs = comparison.differs;
    dispose = comparison.dispose;
  },
}));
vi.mock("./canvas-texture", () => ({
  CanvasTexture: class {
    texture = {};
    framebuffer = {};
    upload() {}
    dispose() {}
  },
}));
const canvas = () => ({ width: 80, height: 40 }) as HTMLCanvasElement;
const signal = () => new AbortController().signal;

describe("accepted texture content", () => {
  beforeEach(() => {
    comparison.differs.mockReset().mockResolvedValue(false);
  });

  it("keeps the accepted GPU texture for equivalent pixels from a new canvas object", async () => {
    const texture = new ContentTexture({} as WebGL2RenderingContext);
    expect((await texture.update(canvas(), signal())).changed).toBe(true);
    const accepted = texture.framebuffer;
    expect((await texture.update(canvas(), signal())).changed).toBe(false);
    expect(texture.framebuffer).toBe(accepted);
    expect(comparison.differs).toHaveBeenCalledOnce();
    texture.dispose();
  });

  it("compares a reused canvas object instead of treating identity as unchanged content", async () => {
    const texture = new ContentTexture({} as WebGL2RenderingContext);
    const source = canvas();
    await texture.update(source, signal());
    const accepted = texture.framebuffer;
    comparison.differs.mockResolvedValueOnce(true);
    expect((await texture.update(source, signal())).changed).toBe(true);
    expect(texture.framebuffer).not.toBe(accepted);
    texture.dispose();
  });

  it("does not accept obsolete pixels when the capture is cancelled during comparison", async () => {
    const texture = new ContentTexture({} as WebGL2RenderingContext);
    await texture.update(canvas(), signal());
    const accepted = texture.framebuffer;
    const controller = new AbortController();
    comparison.differs.mockImplementationOnce(async () => {
      controller.abort();
      return true;
    });
    await expect(
      texture.update(canvas(), controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(texture.framebuffer).toBe(accepted);
    texture.dispose();
  });
});
