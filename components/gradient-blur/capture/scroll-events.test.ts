import { afterEach, describe, expect, it, vi } from "vitest";
import { attachScrollEvents } from "./scroll-events";

afterEach(() => vi.useRealTimers());

it("invalidates on every scroll and captures the final position only once", () => {
  vi.useFakeTimers();
  const source = new EventTarget();
  const onScroll = vi.fn();
  const onScrollEnd = vi.fn();
  const detach = attachScrollEvents(source, { onScroll, onScrollEnd });
  source.dispatchEvent(new Event("scroll"));
  expect(onScroll).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(100);
  source.dispatchEvent(new Event("scroll"));
  vi.advanceTimersByTime(100);
  expect(onScrollEnd).not.toHaveBeenCalled();
  source.dispatchEvent(new Event("scrollend"));
  vi.advanceTimersByTime(200);
  expect(onScrollEnd).toHaveBeenCalledTimes(1);
  detach();
});

describe("scrollend fallback", () => {
  it("flushes live scrolling when native scrollend is missing, and cleans up", () => {
    vi.useFakeTimers();
    const source = new EventTarget();
    const onScrollEnd = vi.fn();
    const detach = attachScrollEvents(source, {
      onScroll: vi.fn(),
      onScrollEnd,
    });
    source.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(140);
    expect(onScrollEnd).toHaveBeenCalledTimes(1);
    source.dispatchEvent(new Event("scroll"));
    detach();
    vi.advanceTimersByTime(140);
    source.dispatchEvent(new Event("scroll"));
    expect(onScrollEnd).toHaveBeenCalledTimes(1);
  });
});
