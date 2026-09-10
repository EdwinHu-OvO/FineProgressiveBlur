import { afterEach, expect, it, vi } from "vitest";
import { observeOverlayLayout } from "./observe-overlay-layout";

afterEach(() => vi.unstubAllGlobals());

it("recaptures a moved overlay and ignores fallback visibility mutations", () => {
  let notify = () => {};
  const disconnect = vi.fn();
  vi.stubGlobal(
    "MutationObserver",
    class {
      constructor(callback: () => void) {
        notify = callback;
      }
      observe() {}
      disconnect = disconnect;
    },
  );
  const bounds = { left: 0, top: 0, width: 400, height: 100 };
  const element = { getBoundingClientRect: () => bounds } as HTMLElement;
  const changed = vi.fn();
  const stop = observeOverlayLayout(element, changed);
  notify();
  expect(changed).not.toHaveBeenCalled();
  bounds.top = 300;
  notify();
  expect(changed).toHaveBeenCalledTimes(1);
  notify();
  expect(changed).toHaveBeenCalledTimes(1);
  stop();
  expect(disconnect).toHaveBeenCalledOnce();
});
