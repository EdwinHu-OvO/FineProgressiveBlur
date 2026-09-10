import { useEffect, useState, type RefObject } from "react";
import type { CardRegion } from "./card-regions";

/** Batch card geometry reads once per frame; only visible cards enter the clip. */
export function useCardRegions(root: RefObject<HTMLElement | null>) {
  const [regions, setRegions] = useState<readonly CardRegion[]>([]);
  useEffect(() => {
    if (!root.current) return;
    const cards = [
      ...root.current.querySelectorAll<HTMLElement>("[data-blur-card]"),
    ];
    let frame = 0,
      previous = "";
    const measure = () => {
      frame = 0;
      const next = cards.flatMap((card): CardRegion[] => {
        const rect = card.getBoundingClientRect();
        if (
          rect.bottom <= 0 ||
          rect.top >= innerHeight ||
          rect.right <= 0 ||
          rect.left >= innerWidth
        )
          return [];
        return [
          {
            id: card.dataset.blurCard!,
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height,
            radius: parseFloat(getComputedStyle(card).borderTopLeftRadius) || 0,
          },
        ];
      });
      const key = JSON.stringify(next);
      if (key !== previous) {
        previous = key;
        setRegions(next);
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(schedule);
    cards.forEach((card) => observer.observe(card));
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [root]);
  return regions;
}
