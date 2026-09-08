import { attachContentEvents } from "../capture/content-events";
import { attachScrollEvents } from "../capture/scroll-events";

interface SurfaceEvents {
  content(): void;
  scroll(nested: boolean): void;
  scrollEnd(): void;
  resize(): void;
  visible(visible: boolean): void;
  lost(event: Event): void;
}

export function attachSurfaceEvents(
  source: HTMLElement,
  canvas: HTMLCanvasElement,
  events: SurfaceEvents,
): () => void {
  const content = attachContentEvents(source, events.content);
  const scroll = (event: Event) => events.scroll(event.target !== source);
  const end = attachScrollEvents(source, {
    onScroll: () => {},
    onScrollEnd: events.scrollEnd,
  });
  const resize = new ResizeObserver(events.resize);
  resize.observe(source);
  if (source.parentElement) resize.observe(source.parentElement);
  let intersecting = true;
  const visibility = () =>
    events.visible(intersecting && document.visibilityState !== "hidden");
  const intersection = new IntersectionObserver(([entry]) => {
    intersecting = entry.isIntersecting;
    visibility();
  });
  intersection.observe(source);
  source.addEventListener("scroll", scroll, { passive: true, capture: true });
  window.addEventListener("resize", events.resize);
  document.addEventListener("visibilitychange", visibility);
  canvas.addEventListener("webglcontextlost", events.lost);
  return () => {
    content();
    end();
    resize.disconnect();
    intersection.disconnect();
    source.removeEventListener("scroll", scroll, true);
    window.removeEventListener("resize", events.resize);
    document.removeEventListener("visibilitychange", visibility);
    canvas.removeEventListener("webglcontextlost", events.lost);
  };
}
