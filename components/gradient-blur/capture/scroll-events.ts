interface ScrollCallbacks {
  onScroll(): void;
  onScrollEnd(): void;
}

/** Capture nested scrollers too; deduplicate native and timer scrollend. */
export function attachScrollEvents(
  target: EventTarget,
  callbacks: ScrollCallbacks,
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const end = () => {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
    callbacks.onScrollEnd();
  };
  const scroll = () => {
    callbacks.onScroll();
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(end, 140);
  };
  target.addEventListener("scroll", scroll, { passive: true, capture: true });
  target.addEventListener("scrollend", end, { passive: true, capture: true });
  return () => {
    target.removeEventListener("scroll", scroll, true);
    target.removeEventListener("scrollend", end, true);
    if (timer !== null) clearTimeout(timer);
  };
}
