/** Observe descendant layout changes even when the scroll container keeps its size. */
export function observeContentResize(
  source: HTMLElement,
  changed: () => void,
  ignored: (node: Node) => boolean,
): { sync(): void; disconnect(): void } {
  if (typeof ResizeObserver === "undefined")
    return { sync: () => {}, disconnect: () => {} };
  const observed = new Set<Element>();
  const sizes = new WeakMap<Element, string>();
  const observer = new ResizeObserver((entries) => {
    let dirty = false;
    for (const entry of entries) {
      const size = `${entry.contentRect.width}:${entry.contentRect.height}`;
      if (sizes.has(entry.target) && sizes.get(entry.target) !== size)
        dirty = true;
      sizes.set(entry.target, size);
    }
    if (dirty) changed();
  });
  const sync = () => {
    const current = new Set(
      [source, ...source.querySelectorAll("*")].filter((node) => !ignored(node)),
    );
    for (const node of observed) {
      if (current.has(node)) continue;
      observer.unobserve(node);
      observed.delete(node);
      sizes.delete(node);
    }
    for (const node of current) {
      if (observed.has(node)) continue;
      observed.add(node);
      observer.observe(node);
    }
  };
  sync();
  return { sync, disconnect: () => observer.disconnect() };
}
