import { useEffect, type RefObject } from "react";

import { gsap, ScrollTrigger } from "@/lib/gsap";
import { createSmoothScroll, isTouchOnly, settleSmoother } from "@/scroll/smoother";
import { documentTop, snapProgress, type SnapLayout } from "@/scroll/snap";

export const SNAP_SECONDS = 0.6;
export const SNAP_EASE = "power2.inOut";
/** how long after the last scroll update before the snap sets off */
export const SNAP_DELAY_SECONDS = 0.1;

const SECTIONS = "section[data-screen-label]";

type Refs = {
  /** ScrollSmoother's fixed viewport */
  wrapper: RefObject<HTMLElement | null>;
  /** the element the smoother moves */
  content: RefObject<HTMLElement | null>;
  /** the six-section scene; the snap region */
  scene: RefObject<HTMLElement | null>;
  /**
   * the scene's sticky layers (canvas, chrome). CSS sticky is inert inside a
   * transformed content, so while the smoother transforms they are held by a
   * scrubbed translate over the scene instead — the same motion, as a transform.
   */
  held: RefObject<HTMLElement | null>[];
};

/**
 * Smooth wheel scrolling with a scene-only waypoint snap. Under reduced motion
 * nothing is created: native scroll, CSS sticky, no snap. On touch-only devices
 * the smoother is skipped too (native momentum) but the snap still applies.
 */
export function useSmoothScroll({ wrapper, content, scene, held }: Refs, reducedMotion: boolean): void {
  useEffect(() => {
    const wrapperEl = wrapper.current;
    const contentEl = content.current;
    const sceneEl = scene.current;
    if (reducedMotion || !wrapperEl || !contentEl || !sceneEl) return;

    const smooth = createSmoothScroll(wrapperEl, contentEl, { reducedMotion, touch: isTouchOnly() });
    const ctx = gsap.context(() => {
      if (smooth?.transforms) {
        for (const ref of held) {
          const el = ref.current;
          if (!el) continue;
          // sticky, as a transform: travel with the scroll until the layer's
          // bottom meets the scene's bottom, then leave with the last section
          const travel = () => sceneEl.offsetHeight - el.offsetHeight;
          gsap.to(el, {
            y: travel,
            ease: "none",
            scrollTrigger: { trigger: sceneEl, start: "top top", end: () => `+=${travel()}`, scrub: true, invalidateOnRefresh: true },
          });
        }
      }

      let layout: SnapLayout = { tops: [], end: 0 };
      ScrollTrigger.create({
        trigger: sceneEl,
        start: "top top",
        end: "bottom bottom",
        onRefresh: (self) => {
          const sections = Array.from(sceneEl.querySelectorAll<HTMLElement>(SECTIONS));
          layout = { tops: sections.map(documentTop), end: self.end };
        },
        // ScrollTrigger only snaps while the scroll is inside start..end, so the long-form is free
        snap: {
          snapTo: (progress, self) => snapProgress(progress, self?.start ?? 0, layout),
          duration: SNAP_SECONDS,
          ease: SNAP_EASE,
          delay: SNAP_DELAY_SECONDS,
          onComplete: () => smooth && settleSmoother(smooth.smoother),
        },
      });
    });

    return () => {
      ctx.revert();
      smooth?.dispose();
    };
  }, [wrapper, content, scene, held, reducedMotion]);
}
