import { ContentTexture } from "../engine/content-texture";
import { paintCommands } from "./paint-commands";
import type { DomScene } from "./dom-scene";
import { tileSignature } from "./tile-signature";

interface Tile {
  texture: ContentTexture;
  top: number;
  height: number;
  version: number;
  used: number;
  signature: string;
}
const TILE_HEIGHT = 1024;
const CACHE_BYTES = 64 * 1024 * 1024;

/** Retains content tiles on the GPU. Scrolling cached content never paints or uploads. */
export class SceneTiles {
  private readonly tiles = new Map<number, Tile>();
  private readonly canvas = document.createElement("canvas");
  private readonly ctx: CanvasRenderingContext2D;
  private scene: DomScene | null = null;
  private signature = "";
  private version = 0;
  private pixelRatio = 0;
  private width = 0;
  private maxTiles = 1;
  paintCount = 0;
  uploadMs = 0;

  constructor(private readonly gl: WebGL2RenderingContext) {
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D is unavailable");
    this.ctx = ctx;
  }

  setScene(scene: DomScene): boolean {
    const signature = JSON.stringify([
      scene.width,
      scene.height,
      scene.commands,
    ]);
    const changed = signature !== this.signature;
    this.scene = scene;
    if (changed) {
      this.signature = signature;
      this.version += 1;
    }
    return changed;
  }

  async prepare(
    scrollTop: number,
    height: number,
    ratio: number,
    signal: AbortSignal,
  ): Promise<boolean> {
    if (!this.scene) return false;
    const width = Math.ceil(this.scene.width * ratio);
    if (width !== this.width || ratio !== this.pixelRatio) {
      this.clear();
      const maxSize = this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE) as number;
      if (width > maxSize || width * TILE_HEIGHT * 9 > CACHE_BYTES)
        throw new Error("Rito: content width exceeds the texture cache budget");
      this.width = width;
      this.pixelRatio = ratio;
      // Two RGBA candidates and a one-channel comparison target per tile.
      this.maxTiles = Math.max(
        1,
        Math.floor(CACHE_BYTES / (width * TILE_HEIGHT * 9)),
      );
    }
    const total = Math.ceil((this.scene.height * ratio) / TILE_HEIGHT);
    const first = Math.max(0, Math.floor((scrollTop * ratio) / TILE_HEIGHT));
    const last = Math.min(
      total - 1,
      Math.floor(((scrollTop + height) * ratio) / TILE_HEIGHT),
    );
    if (last - first + 1 > this.maxTiles)
      throw new Error("Rito: viewport exceeds the texture cache budget");
    // Small documents are painted completely once. Large ones have a bounded working set.
    const indices =
      total <= this.maxTiles
        ? Array.from({ length: total }, (_, i) => i)
        : Array.from({ length: last - first + 1 }, (_, i) => first + i);
    const protectedIndices = new Set(indices);
    let changed = false;
    this.uploadMs = 0;
    for (const index of indices) {
      signal.throwIfAborted();
      let tile = this.tiles.get(index);
      if (!tile) {
        this.evict(protectedIndices);
        tile = {
          texture: new ContentTexture(this.gl),
          top: index * TILE_HEIGHT,
          height: Math.min(
            TILE_HEIGHT,
            Math.ceil(this.scene.height * ratio) - index * TILE_HEIGHT,
          ),
          version: -1,
          used: 0,
          signature: "",
        };
        this.tiles.set(index, tile);
      }
      tile.used = performance.now();
      if (tile.version === this.version) continue;
      // A content edit can grow or shrink the final tile without changing DPR.
      const tileHeight = Math.min(
        TILE_HEIGHT,
        Math.ceil(this.scene.height * ratio) - tile.top,
      );
      const signature = tileSignature(
        this.scene.commands,
        tile.top / ratio,
        tileHeight / ratio,
      );
      if (signature === tile.signature && tile.height === tileHeight) {
        tile.version = this.version;
        continue;
      }
      tile.height = tileHeight;
      this.canvas.width = width;
      this.canvas.height = tile.height;
      this.ctx.setTransform(ratio, 0, 0, ratio, 0, -tile.top);
      paintCommands(this.ctx, this.scene.commands, this.scene.images);
      const result = await tile.texture.update(this.canvas, signal);
      this.paintCount += 1;
      this.uploadMs += result.uploadMs;
      tile.version = this.version;
      tile.signature = signature;
      if (index >= first && index <= last) changed ||= result.changed;
    }
    return changed;
  }

  copyTo(
    framebuffer: WebGLFramebuffer,
    scrollLeft: number,
    scrollTop: number,
    width: number,
    height: number,
  ): void {
    const gl = this.gl;
    const left = Math.round(scrollLeft * this.pixelRatio);
    const top = Math.round(scrollTop * this.pixelRatio);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, framebuffer);
    for (const tile of this.tiles.values()) {
      const start = Math.max(top, tile.top);
      const end = Math.min(top + height, tile.top + tile.height);
      if (end <= start || tile.version !== this.version) continue;
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, tile.texture.framebuffer);
      gl.blitFramebuffer(
        left,
        start - tile.top,
        left + width,
        end - tile.top,
        0,
        start - top,
        width,
        end - top,
        gl.COLOR_BUFFER_BIT,
        gl.NEAREST,
      );
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  get retainedBytes(): number {
    return Array.from(this.tiles.values()).reduce(
      (sum, tile) => sum + this.width * tile.height * 9,
      0,
    );
  }

  dispose(): void {
    this.clear();
    this.canvas.width = this.canvas.height = 1;
  }

  private clear(): void {
    for (const tile of this.tiles.values()) tile.texture.dispose();
    this.tiles.clear();
  }

  private evict(protectedIndices: ReadonlySet<number>): void {
    if (this.tiles.size < this.maxTiles) return;
    const candidate = Array.from(this.tiles.entries())
      .filter(([index]) => !protectedIndices.has(index))
      .sort((a, b) => a[1].used - b[1].used)[0];
    if (!candidate) throw new Error("Rito: texture cache is full");
    candidate[1].texture.dispose();
    this.tiles.delete(candidate[0]);
  }
}
