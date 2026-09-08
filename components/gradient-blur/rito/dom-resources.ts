import type { Rect } from "./vendor/frame-types";

type Drawable = ImageBitmap | HTMLImageElement;

/** Resource identity participates in scene equality, independently of DOM mutations. */
export class DomResources {
  private readonly cached = new Map<string, Promise<Drawable>>();
  private generation = 0;
  private epoch = 0;
  private disposed = false;

  async image(element: HTMLImageElement): Promise<[string, Drawable]> {
    if (!element.complete) await element.decode();
    if (!element.naturalWidth)
      throw new Error("Rito: image could not be decoded");
    return [
      `image:${this.epoch}:${element.currentSrc || element.src}:${element.naturalWidth}:${element.naturalHeight}`,
      element,
    ];
  }

  async canvas(element: HTMLCanvasElement): Promise<[string, Drawable]> {
    const key = `canvas:${++this.generation}`;
    return [key, await this.load(key, () => createImageBitmap(element))];
  }

  async svg(
    element: SVGSVGElement,
    bounds: Rect,
    pixelRatio: number,
  ): Promise<[string, Drawable]> {
    const clone = element.cloneNode(true) as SVGSVGElement;
    const originals = [element, ...element.querySelectorAll("*")];
    const copies = [clone, ...clone.querySelectorAll("*")];
    const properties = [
      "fill",
      "fill-opacity",
      "fill-rule",
      "stroke",
      "stroke-width",
      "stroke-opacity",
      "stroke-linecap",
      "stroke-linejoin",
      "stroke-dasharray",
      "stroke-dashoffset",
      "opacity",
      "font",
      "color",
      "visibility",
      "paint-order",
      "transform",
      "transform-origin",
      "transform-box",
      "clip-path",
      "mask",
      "filter",
    ];
    originals.forEach((original, index) => {
      const style = getComputedStyle(original);
      const target = copies[index] as SVGElement;
      for (const property of properties) {
        const value = style
          .getPropertyValue(property)
          .replace(
            /url\(["']?([^)]*?)["']?\)/g,
            (_match, reference: string) => {
              const id = reference.slice(reference.lastIndexOf("#") + 1);
              if (
                !reference.includes("#") ||
                !element.querySelector(`#${CSS.escape(id)}`)
              )
                throw new Error(
                  "Rito: SVG paint references must be self-contained",
                );
              return `url("#${id}")`;
            },
          );
        target.style.setProperty(
          property,
          index === 0 && property === "opacity" ? "1" : value,
        );
      }
      if (original.localName === "foreignObject")
        throw new Error("Rito: SVG foreignObject is not supported");
      if (
        ["animate", "animateTransform", "animateMotion", "set"].includes(
          original.localName,
        )
      )
        throw new Error("Rito: animated SVG is not supported");
      if (original.localName === "use") {
        const href =
          original.getAttribute("href") ?? original.getAttribute("xlink:href");
        if (
          href &&
          (!href.startsWith("#") ||
            !element.querySelector(`#${CSS.escape(href.slice(1))}`))
        )
          throw new Error("Rito: external SVG references are not supported");
      }
    });
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    if (!element.hasAttribute("viewBox"))
      clone.setAttribute("viewBox", `0 0 ${bounds.width} ${bounds.height}`);
    clone.setAttribute("width", String(bounds.width * pixelRatio));
    clone.setAttribute("height", String(bounds.height * pixelRatio));
    clone.style.width = `${bounds.width * pixelRatio}px`;
    clone.style.height = `${bounds.height * pixelRatio}px`;
    const markup = new XMLSerializer().serializeToString(clone);
    const key = `svg:${this.epoch}:${markup}`;
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
    const key = `background:${this.epoch}:${url}`;
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
    this.epoch += 1;
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
