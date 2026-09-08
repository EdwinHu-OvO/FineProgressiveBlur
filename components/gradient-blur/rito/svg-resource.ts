import type { Rect } from "./vendor/frame-types";

export function serializeSvg(element: SVGSVGElement, bounds: Rect, pixelRatio: number): string {
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
    return markup;
}
