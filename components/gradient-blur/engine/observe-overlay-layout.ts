/** Style/class changes can move an overlay without notifying ResizeObserver. */
export function observeOverlayLayout(
  element: HTMLElement,
  changed: () => void,
) {
  const geometry = () => {
    const { left, top, width, height } = element.getBoundingClientRect();
    return `${left}:${top}:${width}:${height}`;
  };
  let previous = geometry();
  const observer = new MutationObserver(() => {
    const next = geometry();
    // The renderer also writes the fallback-display custom property. Ignore
    // those mutations to avoid a capture/metrics/style feedback loop.
    if (next === previous) return;
    previous = next;
    changed();
  });
  observer.observe(element, {
    attributes: true,
    attributeFilter: ["style", "class"],
  });
  return () => observer.disconnect();
}
