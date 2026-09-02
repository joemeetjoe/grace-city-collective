import { ScrollTrigger } from "gsap/ScrollTrigger";

import { gsap } from "@/lib/gsap";
import { activeSection } from "./activeSection";
import type { WatchedSection } from "./sections";
import { documentTop } from "./snap";

// the triggers below; registering again elsewhere is a no-op
gsap.registerPlugin(ScrollTrigger);

/** the ScrollTrigger band a section is active in: while it spans the viewport's midpoint */
export const ACTIVE_START = "top 50%";
export const ACTIVE_END = "bottom 50%";

/** a section and where it starts, document-relative, as of the last measure */
export type SectionBox = WatchedSection & { top: number };

export type SectionWatch = {
  /** every watched section's document top, in page order, as of the last refresh */
  boxes(): readonly SectionBox[];
  /** told after every re-measure; returns the function that stops listening */
  onMeasure(listener: () => void): () => void;
  stop(): void;
};

/**
 * The one ScrollTrigger set over the page's sections. One trigger per
 * section, active while the section spans the viewport's midpoint — so it
 * holds in the scene and the long-form alike, and under the smoother, whose
 * scroll ScrollTrigger already follows. A trigger entering the band makes
 * its section active (`setActive`); one leaving never clears it: the next
 * section's trigger takes over, and past the last section (the footer) the
 * last stays current. On every refresh (load, resize, the smoother's own,
 * the long-form chunk mounting) the active section is settled from the
 * boxes themselves, so it is right before anything has scrolled, and the
 * sections' document tops are measured again for whoever pages by them
 * (attachPager.ts, through `boxes` and `onMeasure`).
 */
export function watchSections(sections: WatchedSection[], setActive: (id: string) => void): SectionWatch {
  let boxes: SectionBox[] = [];
  const listeners = new Set<() => void>();
  const ctx = gsap.context(() => {
    for (const { id, el } of sections) {
      ScrollTrigger.create({
        trigger: el,
        start: ACTIVE_START,
        end: ACTIVE_END,
        onToggle: (self) => {
          if (self.isActive) setActive(id);
        },
      });
    }
  });
  const measure = () => {
    boxes = sections.map((s) => ({ ...s, top: documentTop(s.el) }));
    // bounding rects follow the smoothed position: the section under the midpoint now
    const id = activeSection(
      window.innerHeight / 2,
      sections.map(({ id, el }) => ({ id, top: el.getBoundingClientRect().top })),
    );
    if (id) setActive(id);
    for (const listener of listeners) listener();
  };
  ScrollTrigger.addEventListener("refresh", measure);
  measure();
  return {
    boxes: () => boxes,
    onMeasure(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    stop() {
      ScrollTrigger.removeEventListener("refresh", measure);
      listeners.clear();
      ctx.revert();
    },
  };
}
