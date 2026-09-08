import { observeContentResize } from "./content-resize";

export type ContentChange =
  | { kind: "dom" }
  | { kind: "fonts" }
  | { kind: "image"; element: HTMLImageElement };

/** Events mark content dirty; retained paint commands reject no-op changes before rasterizing. */
export function attachContentEvents(
  source: HTMLElement,
  changed: (change: ContentChange) => void,
): () => void {
  let frame = 0;
  let disposed = false;
  const videos = new WeakMap<HTMLVideoElement, number>();
  const isOverlay = (node: Node) =>
    Boolean(
      (node instanceof Element ? node : node.parentElement)?.closest(
        "[data-gradient-blur-overlay], [data-gradient-blur-rito], [data-gradient-blur-twin-ignore]",
      ),
    );
  const runningAnimation = () =>
    source
      .getAnimations({ subtree: true })
      .some((animation) => animation.playState === "running");
  const tick = () => {
    frame = 0;
    if (disposed || document.visibilityState === "hidden") return;
    let active = runningAnimation();
    let dirty = active;
    for (const video of source.querySelectorAll("video")) {
      if (video.paused || video.ended) continue;
      active = true;
      if (videos.get(video) !== video.currentTime) dirty = true;
      videos.set(video, video.currentTime);
    }
    if (dirty) changed({ kind: "dom" });
    if (active) frame = requestAnimationFrame(tick);
  };
  const check = (change: ContentChange = { kind: "dom" }) => {
    if (disposed) return;
    changed(change);
    if (!frame) frame = requestAnimationFrame(tick);
  };
  const resize = observeContentResize(source, () => check(), isOverlay);
  const observer = new MutationObserver((records) => {
    const relevant = records.filter((record) => {
      if (isOverlay(record.target)) return false;
      if (record.type === "attributes")
        return (
          record.oldValue !==
          (record.target as Element).getAttribute(record.attributeName!)
        );
      if (record.type === "characterData")
        return record.oldValue !== record.target.textContent;
      return [...record.addedNodes, ...record.removedNodes].some((node) => !isOverlay(node));
    });
    if (relevant.some((record) => record.type === "childList")) resize.sync();
    if (relevant.length) check();
  });
  observer.observe(source, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeOldValue: true,
    characterDataOldValue: true,
  });
  // Stylesheet edits and font completion can change pixels without changing source nodes.
  if (document.head)
    observer.observe(document.head, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeOldValue: true,
      characterDataOldValue: true,
    });
  const onEvent = (event: Event) => {
    if (!(event.target instanceof Node) || isOverlay(event.target)) return;
    check(
      event.type === "load" && event.target instanceof HTMLImageElement
        ? { kind: "image", element: event.target }
        : { kind: "dom" },
    );
  };
  const events = [
    "input",
    "change",
    "load",
    "error",
    "focusin",
    "focusout",
    "pointerover",
    "pointerout",
    "animationstart",
    "animationend",
    "animationcancel",
    "transitionrun",
    "transitionend",
    "transitioncancel",
    "play",
    "pause",
    "seeked",
    "loadeddata",
  ];
  for (const event of events) source.addEventListener(event, onEvent, true);
  const fonts = () => check({ kind: "fonts" });
  const visibility = () => {
    if (document.visibilityState !== "hidden") check();
  };
  document.fonts?.addEventListener("loadingdone", fonts);
  document.fonts?.addEventListener("loadingerror", fonts);
  document.addEventListener("visibilitychange", visibility);
  // Animations or video may already be playing when the observer is installed.
  frame = requestAnimationFrame(tick);
  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    observer.disconnect();
    resize.disconnect();
    for (const event of events)
      source.removeEventListener(event, onEvent, true);
    document.fonts?.removeEventListener("loadingdone", fonts);
    document.fonts?.removeEventListener("loadingerror", fonts);
    document.removeEventListener("visibilitychange", visibility);
  };
}
