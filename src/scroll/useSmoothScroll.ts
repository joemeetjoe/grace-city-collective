import { useEffect, useRef, useState, type RefObject } from "react";

import { useBelowLg } from "@/layout/breakpoint";
import { useAppStore } from "@/state/appStore";
import { attachPager } from "./attachPager";
import { readScrollTop, type ScrollDriver } from "./position";
import type { SectionRegistry } from "./sections";
import { watchSections, type SectionWatch } from "./sectionWatch";
import { createSmoothScroll, holdStickyLayers, isTouchOnly, type SmoothScroll } from "./smoother";

export type ScrollRefs = {
  /** ScrollSmoother's fixed viewport */
  wrapper: RefObject<HTMLElement | null>;
  /** the element the smoother moves */
  content: RefObject<HTMLElement | null>;
  /** the six-section scene; the paged region */
  scene: RefObject<HTMLElement | null>;
  /** the scene's sticky layers (canvas, chrome), held by a transform while the smoother transforms (smoother.ts) */
  held: RefObject<HTMLElement | null>[];
  /** every section of the page, scene and long-form, by ref (sections.ts) */
  sections: SectionRegistry;
};

export type ScrollMode = "native" | "paged";

export type ScrollModeInputs = {
  /** the visitor prefers reduced motion */
  reducedMotion: boolean;
  /** the viewport is narrower than Tailwind's lg (layout/breakpoint.ts) */
  belowLg: boolean;
};

/**
 * Whether the scene is paged at all. Pure. Native means no paging: the
 * window scrolls by the wheel's or the finger's own measure — under reduced
 * motion, and below lg, where a section is as tall as its words and a swipe
 * must move the page by the finger's own measure, not a whole section (#52).
 * Paged is the desktop: the turns and the settle (attachPager.ts).
 */
export function scrollMode({ reducedMotion, belowLg }: ScrollModeInputs): ScrollMode {
  return reducedMotion || belowLg ? "native" : "paged";
}

/** the page's scroll, for whoever reads or moves it: the nav's jumps, the engine's camera */
export type PageScroll = {
  /** the smoother's driver while one runs; null under native scroll */
  driver(): ScrollDriver | null;
  /** the current scroll position, whichever is driving */
  scrollTop(): number;
};

/**
 * Smooth wheel scrolling, with the scene turned like pages. Three pieces,
 * each its own effect over the refs it is given:
 *
 * - the smoother (smoother.ts) over wrapper/content, unless reduced motion
 *   or a touch-only device keeps native scroll; while it transforms the
 *   content the scene's sticky layers are held by a scrubbed transform. It
 *   lives for the mount: a resize across lg does not rebuild it.
 * - the section watch (sectionWatch.ts): one ScrollTrigger per section,
 *   writing the store's activeId and measuring the sections' tops.
 * - the pager (attachPager.ts, pager.ts) over the scene, in paged mode
 *   only (scrollMode): a resize across lg tears it down or builds it, whole,
 *   reading its layout from the watch.
 *
 * Returns the page's scroll accessor: the driver on the smoother's handle
 * while one runs, so nothing module-level holds it.
 */
export function useSmoothScroll({ wrapper, content, scene, held, sections }: ScrollRefs): PageScroll {
  const reducedMotion = useAppStore((s) => s.reducedMotion);
  const belowLg = useBelowLg();
  const smoothRef = useRef<SmoothScroll | null>(null);
  const watchRef = useRef<SectionWatch | null>(null);
  const [scroll] = useState<PageScroll>(() => ({
    driver: () => smoothRef.current?.driver ?? null,
    scrollTop: () => readScrollTop(smoothRef.current?.driver ?? null),
  }));

  useEffect(() => {
    const wrapperEl = wrapper.current;
    const contentEl = content.current;
    const sceneEl = scene.current;
    if (!wrapperEl || !contentEl || !sceneEl) return;
    const smooth = createSmoothScroll(wrapperEl, contentEl, { reducedMotion, touch: isTouchOnly() });
    if (!smooth) return;
    smoothRef.current = smooth;
    const letGo = smooth.transforms
      ? holdStickyLayers(sceneEl, held.flatMap((ref) => (ref.current ? [ref.current] : [])))
      : () => {};
    return () => {
      letGo();
      smooth.dispose();
      smoothRef.current = null;
    };
  }, [wrapper, content, scene, held, reducedMotion]);

  useEffect(() => {
    const watch = watchSections(sections.sections(), useAppStore.getState().setActiveId);
    watchRef.current = watch;
    return () => {
      watch.stop();
      watchRef.current = null;
    };
  }, [sections]);

  useEffect(() => {
    const sceneEl = scene.current;
    const watch = watchRef.current;
    if (scrollMode({ reducedMotion, belowLg }) === "native" || !sceneEl || !watch) return;
    // the paged region's tops: the sections inside the scene, not the long-form's
    const paged = new Set(sections.sections().flatMap(({ id, el }) => (sceneEl.contains(el) ? [id] : [])));
    return attachPager({
      scene: sceneEl,
      smooth: smoothRef.current,
      tops: () => watch.boxes().flatMap((b) => (paged.has(b.id) ? [b.top] : [])),
      onMeasure: watch.onMeasure,
    });
  }, [scene, sections, reducedMotion, belowLg]);

  return scroll;
}
