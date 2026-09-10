import { createUniformAtlasLayout, type AtlasLayout } from "./atlas-layout";
import { GradientBlurRenderer } from "./GradientBlurRenderer";
import type { BlurRenderProfile } from "./gaussian-blur";
import type { OverlayRenderProfile } from "./overlay-mode";
import type { SurfaceFrame } from "./surface-overlay";

interface CachedUniform {
  renderer: GradientBlurRenderer;
  profile: BlurRenderProfile;
  atlas: AtlasLayout;
  atlasBuildMs: number;
  uploadMs: number;
  estimatedBytes: number;
}

/** One full-source Gaussian per radius; all uniform overlays sample its result. */
export class StaticUniformCache {
  private readonly entries = new Map<string, CachedUniform>();
  private readonly used = new Set<string>();
  private version = 0;

  beginFrame(contentChanged: boolean) {
    if (contentChanged) this.clear();
    this.used.clear();
  }

  get(profile: OverlayRenderProfile, frame: SurfaceFrame) {
    const { canvas, pixelRatio } = frame;
    const radius = Number.isFinite(profile.maxRadius)
      ? Math.max(0, profile.maxRadius)
      : 0;
    const key = `${this.version}:${canvas.width}:${canvas.height}:${pixelRatio}:${radius}:${profile.algorithm ?? "compact9"}`;
    this.used.add(key);
    const existing = this.entries.get(key);
    if (existing) {
      this.entries.delete(key);
      this.entries.set(key, existing);
      return { ...existing, key, hit: true };
    }
    const started = performance.now();
    const atlas = createUniformAtlasLayout(
      canvas.width,
      canvas.height,
      radius,
      pixelRatio,
    );
    const atlasBuildMs = performance.now() - started;
    const renderer = new GradientBlurRenderer(canvas, frame.scene.gl);
    const resolved: BlurRenderProfile = {
      direction: "top",
      maxRadius: radius,
      algorithm: profile.algorithm,
      uniformRadius: true,
      materialize: true,
    };
    try {
      const uploadStarted = performance.now();
      const bounds = canvas.getBoundingClientRect();
      renderer.uploadGpuAtlas(
        frame.scene.framebuffer,
        { x: 0, y: 0, width: canvas.width, height: canvas.height },
        atlas,
        resolved,
        {
          width: bounds.width,
          height: bounds.height,
        },
      );
      const entry = {
        renderer,
        profile: resolved,
        atlas,
        atlasBuildMs,
        uploadMs:
          (frame.sourceUploadMs ?? 0) + performance.now() - uploadStarted,
        // Conservative source/pyramid + atlas/two Gaussian targets budget.
        estimatedBytes:
          canvas.width * canvas.height * 8 + atlas.width * atlas.height * 12,
      };
      this.entries.set(key, entry);
      return { ...entry, key, hit: false };
    } catch (error) {
      renderer.dispose();
      throw error;
    }
  }

  endFrame() {
    let bytes = [...this.entries.values()].reduce(
      (sum, entry) => sum + entry.estimatedBytes,
      0,
    );
    // Keep active profiles; bound unused history so radius scrubbing cannot grow forever.
    for (const [key, entry] of this.entries) {
      if (
        this.entries.size <= 1 ||
        (this.entries.size <= 4 && bytes <= 64 * 1024 ** 2)
      )
        break;
      if (this.used.has(key)) continue;
      entry.renderer.dispose();
      this.entries.delete(key);
      bytes -= entry.estimatedBytes;
    }
  }

  get size() {
    return this.entries.size;
  }

  clear() {
    for (const entry of this.entries.values()) entry.renderer.dispose();
    this.entries.clear();
    this.used.clear();
    this.version++;
  }
}
