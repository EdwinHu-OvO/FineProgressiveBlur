/** Events nominate a new capture; GPU pixel equality decides whether it needs rendering. */
export function attachContentEvents(
  source: HTMLElement,
  changed: () => void,
): () => void {
  let frame = 0;
  let disposed = false;
  const videos = new WeakMap<HTMLVideoElement, number>();
  const isOverlay = (node: Node) =>
    (node instanceof Element ? node : node.parentElement)?.closest(
      "[data-gradient-blur-overlay]",
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
    if (dirty) changed();
    if (active) frame = requestAnimationFrame(tick);
  };
  const check = () => {
    if (disposed) return;
    changed();
    if (!frame) frame = requestAnimationFrame(tick);
  };
  const observer = new MutationObserver((records) => {
    if (records.some((record) => !isOverlay(record.target))) check();
  });
  observer.observe(source, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
  });
  // Stylesheet edits and font completion can change pixels without changing source nodes.
  if (document.head)
    observer.observe(document.head, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
    });
  const onEvent = (event: Event) => {
    if (event.target instanceof Node && !isOverlay(event.target)) check();
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
  document.fonts?.addEventListener("loadingdone", check);
  document.addEventListener("visibilitychange", check);
  // Animations or video may already be playing when the observer is installed.
  frame = requestAnimationFrame(tick);
  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    observer.disconnect();
    for (const event of events)
      source.removeEventListener(event, onEvent, true);
    document.fonts?.removeEventListener("loadingdone", check);
    document.removeEventListener("visibilitychange", check);
  };
}
