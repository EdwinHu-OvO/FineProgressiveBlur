import { serializeSvg } from "./svg-resource";
import type { Rect } from "./vendor/frame-types";

type Drawable = ImageBitmap | HTMLImageElement;

/** Resource identity participates in scene equality, independently of DOM mutations. */
export class DomResources {
  private readonly cached = new Map<string, Promise<Drawable>>();
  private generation = 0;
  private canvasEpoch = 0;
  private readonly canvasIds = new WeakMap<HTMLCanvasElement, number>();
  private readonly imageVersions = new Map<string, number>();
  fontVersion = 0;
  private disposed = false;

  async image(element: HTMLImageElement): Promise<[string, Drawable]> {
    if (!element.complete) await element.decode();
    if (!element.naturalWidth)
      throw new Error("Rito: image could not be decoded");
    return [
      `image:${this.imageVersions.get(element.currentSrc || element.src) ?? 0}:${element.currentSrc || element.src}:${element.naturalWidth}:${element.naturalHeight}`,
      element,
    ];
  }

  async canvas(element: HTMLCanvasElement): Promise<[string, Drawable]> {
    let id = this.canvasIds.get(element);
    if (id === undefined)
      this.canvasIds.set(element, (id = ++this.generation));
    const key = `canvas:${id}:${this.canvasEpoch}:${element.width}:${element.height}`;
    return [key, await this.load(key, () => createImageBitmap(element))];
  }

  async svg(
    element: SVGSVGElement,
    bounds: Rect,
    pixelRatio: number,
  ): Promise<[string, Drawable]> {
    const markup = serializeSvg(element, bounds, pixelRatio);
    const key = `svg:${this.fontVersion}:${markup}`;
    const drawable = await this.load(key, async () => {
      const url = URL.createObjectURL(
        new Blob([markup], { type: "image/svg+xml" }),
      );
      try {
        const image = new Image();
        image.src = url;
        await image.decode();
        return image;
      } finally {
        URL.revokeObjectURL(url);
      }
    });
    return [key, drawable];
  }

  async background(url: string): Promise<[string, Drawable]> {
    const key = `background:${this.imageVersions.get(url) ?? 0}:${url}`;
    return [
      key,
      await this.load(key, async () => {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.src = url;
        await image.decode();
        return image;
      }),
    ];
  }

  retain(keys: ReadonlySet<string>): void {
    for (const [key, resource] of this.cached) {
      if (keys.has(key)) continue;
      this.cached.delete(key);
      void resource.then(
        (image) => {
          if (image instanceof ImageBitmap) image.close();
        },
        () => {},
      );
    }
  }

  invalidate(): void {
    // Canvas drawing has no DOM mutation signal; refresh explicitly nominates it.
    this.canvasEpoch += 1;
  }

  imageLoaded(element: HTMLImageElement): void {
    const url = element.currentSrc || element.src;
    this.imageVersions.set(url, (this.imageVersions.get(url) ?? 0) + 1);
  }

  fontsChanged(): void {
    this.fontVersion += 1;
  }

  dispose(): void {
    this.disposed = true;
    this.retain(new Set());
  }

  private load(
    key: string,
    create: () => Promise<Drawable>,
  ): Promise<Drawable> {
    let pending = this.cached.get(key);
    if (!pending) {
      pending = create().then((image) => {
        if (this.disposed) {
          if (image instanceof ImageBitmap) image.close();
          throw new DOMException("Disposed", "AbortError");
        }
        return image;
      });
      this.cached.set(key, pending);
    }
    return pending;
  }
}
