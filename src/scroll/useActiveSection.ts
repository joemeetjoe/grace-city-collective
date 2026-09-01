import { useEffect, useState } from "react";

import { gsap, ScrollTrigger } from "@/lib/gsap";
import { activeSection } from "./activeSection";

/** a section on the page, by id and element */
export type WatchedSection = { id: string; el: HTMLElement };

/**
 * Keeps `setActive` told which section is under the viewport's midpoint;
 * returns the function that stops watching. The default watches through
 * ScrollTrigger; tests hand in a stand-in.
 */
export type SectionWatch = (sections: WatchedSection[], setActive: (id: string) => void) => () => void;

/** the ScrollTrigger band a section is active in: while it spans the viewport's midpoint */
export const ACTIVE_START = "top 50%";
export const ACTIVE_END = "bottom 50%";

/**
 * One ScrollTrigger per section, active while the section spans the
 * viewport's midpoint — so it holds in the scene and the long-form alike, and
 * under the smoother, whose scroll ScrollTrigger already follows. A trigger
 * leaving the band never clears the state: the next section's trigger takes
 * over, and past the last section (the footer) the last stays current. On
 * every refresh (load, resize, the smoother's own) the state is settled from
 * the boxes themselves, so it is right before anything has scrolled.
 */
export const watchWithScrollTrigger: SectionWatch = (sections, setActive) => {
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
  const settle = () => {
    const boxes = sections.map(({ id, el }) => ({ id, top: el.getBoundingClientRect().top }));
    const id = activeSection(window.innerHeight / 2, boxes);
    if (id) setActive(id);
  };
  ScrollTrigger.addEventListener("refresh", settle);
  settle();
  return () => {
    ScrollTrigger.removeEventListener("refresh", settle);
    ctx.revert();
  };
};

/**
 * The id of the section under the viewport's midpoint, kept in sync while
 * mounted. `ids` must be stable (memoised): the watch is rebuilt when it
 * changes. Ids with no element on the page are skipped. Starts on the first
 * id until the watch reports.
 */
export function useActiveSection(ids: readonly string[], watch: SectionWatch = watchWithScrollTrigger): string | null {
  const [active, setActive] = useState<string | null>(ids[0] ?? null);
  useEffect(() => {
    const sections = ids.flatMap((id) => {
      const el = document.getElementById(id);
      return el ? [{ id, el }] : [];
    });
    return watch(sections, setActive);
  }, [ids, watch]);
  return active;
}
