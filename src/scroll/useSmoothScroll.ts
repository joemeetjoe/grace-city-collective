import { useEffect, type RefObject } from "react";

import { gsap, Observer, ScrollTrigger } from "@/lib/gsap";
import { inScene, pageTarget, type PageDirection } from "@/scroll/paging";
import { createSmoothScroll, isTouchOnly, settleSmoother, type SmoothScroll } from "@/scroll/smoother";
import { documentTop, snapTo, type SnapLayout } from "@/scroll/snap";
import { idleWheel, stepWheel, wheelPixels, type WheelGesture } from "@/scroll/wheelGesture";

/** one page turn: a section to the next */
export const PAGE_SECONDS = 0.8;
/** a settle: what got past the observer coming to rest on the nearest section */
export const SETTLE_SECONDS = 0.6;
export const PAGE_EASE = "power2.inOut";
/** pixels of wheel or finger before a gesture counts (a mouse notch is ~100) */
export const PAGE_TOLERANCE = 10;
/** how long after the last scroll update before a settle sets off */
export const SETTLE_DELAY_SECONDS = 0.1;
/** px/s under which the scroll counts as at rest (the smoother's lerp tail runs down to this) */
export const REST_VELOCITY = 10;

const SECTIONS = "section[data-screen-label]";
/** a wheel event measured in lines (Firefox), as pixels */
const LINE_PX = 20;

type Refs = {
  /** ScrollSmoother's fixed viewport */
  wrapper: RefObject<HTMLElement | null>;
  /** the element the smoother moves */
  content: RefObject<HTMLElement | null>;
  /** the six-section scene; the paged region */
  scene: RefObject<HTMLElement | null>;
  /**
   * the scene's sticky layers (canvas, chrome). CSS sticky is inert inside a
   * transformed content, so while the smoother transforms they are held by a
   * scrubbed translate over the scene instead — the same motion, as a transform.
   */
  held: RefObject<HTMLElement | null>[];
};

/** the scroll position the page turns write to: the smoother's when there is one, else the window's */
function scrollSeat(smooth: SmoothScroll | null) {
  return smooth
    ? { get: () => smooth.smoother.scrollTop(), set: (y: number) => smooth.smoother.scrollTo(y, false) }
    : { get: () => window.scrollY, set: (y: number) => window.scrollTo(0, y) };
}

/**
 * Smooth wheel scrolling, with the scene turned like pages. Inside the scene
 * the wheel and the finger never scroll: each gesture turns to the next (or
 * previous) section — a swipe with its momentum tail is one gesture
 * (wheelGesture.ts), a finger's press-to-lift another. During a turn only a
 * reversal is heard, and it takes its turn after. At the last section a forward gesture lets go and the
 * long-form scrolls freely; coming back up, the scene takes the scroll again
 * at the last section's top. What gets past the hold (keys, a dragged
 * scrollbar, the tail of a re-entry) settles on the nearest section once it
 * rests. Under reduced motion nothing is created: native scroll, CSS sticky,
 * no paging. On touch-only devices the smoother is skipped (native momentum)
 * but the paging applies.
 *
 * The turns and the settles are one tween over a proxy, written to the scroll
 * each frame — not ScrollTrigger's snap: that one kills its tween on any wheel
 * event, prevented or not, and a swipe's tail keeps those coming.
 */
export function useSmoothScroll({ wrapper, content, scene, held }: Refs, reducedMotion: boolean): void {
  useEffect(() => {
    const wrapperEl = wrapper.current;
    const contentEl = content.current;
    const sceneEl = scene.current;
    if (reducedMotion || !wrapperEl || !contentEl || !sceneEl) return;

    const smooth = createSmoothScroll(wrapperEl, contentEl, { reducedMotion, touch: isTouchOnly() });
    const seat = scrollSeat(smooth);
    let layout: SnapLayout = { tops: [], end: 0 };
    let observer: Observer | null = null;
    let turn: gsap.core.Tween | null = null;
    // the wheel is held (prevented, paged) while the native position is in the scene
    let holding = false;
    let wheel: WheelGesture = idleWheel;
    // the wheel gesture under way still owes a turn; its px so far
    let wheelArmed = false;
    let wheelSum = 0;
    // the finger down still owes a turn
    let touchArmed = false;
    // a gesture made during a turn waits for it: the last one made, when it ends
    let queued: { direction: PageDirection; px: number } | null = null;

    const turnTo = (top: number, seconds: number) => {
      turn?.kill();
      if (smooth) gsap.killTweensOf(smooth.smoother); // an in-flight nav jump gives way
      const proxy = { y: seat.get() };
      turn = gsap.to(proxy, {
        y: top,
        duration: seconds,
        ease: PAGE_EASE,
        onUpdate: () => seat.set(proxy.y),
        onComplete: () => {
          if (smooth) settleSmoother(smooth.smoother);
          const next = queued;
          queued = null;
          if (next) gesture(next.direction, next.px);
        },
      });
    };

    /** one gesture's turn; `px` is how far the gesture had scrolled, for the notch that lets go */
    const gesture = (direction: PageDirection, px: number) => {
      if (turn?.isActive()) {
        queued = { direction, px };
        return;
      }
      const top = pageTarget(seat.get(), direction, layout);
      if (top !== null) {
        turnTo(top, PAGE_SECONDS);
        return;
      }
      if (direction > 0) {
        // the last section lets go: this notch scrolls natively, and the
        // long-form takes the rest of the gesture
        release();
        window.scrollBy(0, px);
      }
    };

    const touchGesture = (direction: PageDirection, delta: number) => {
      if (!touchArmed) return;
      touchArmed = false;
      gesture(direction, Math.abs(delta));
    };

    // a wheel event while holding: prevented, fed to the gesture detector,
    // and the gesture's first PAGE_TOLERANCE px ask for one turn
    const onWheel = (e: WheelEvent) => {
      if (!holding) return;
      e.preventDefault();
      const step = stepWheel(wheel, wheelPixels(e, LINE_PX, window.innerHeight), e.timeStamp, !!turn?.isActive());
      wheel = step.g;
      if (step.began) {
        wheelArmed = true;
        wheelSum = 0;
      }
      wheelSum += wheelPixels(e, LINE_PX, window.innerHeight);
      if (wheelArmed && Math.abs(wheelSum) >= PAGE_TOLERANCE) {
        wheelArmed = false;
        gesture(wheelSum > 0 ? 1 : -1, Math.abs(wheelSum));
      }
    };

    const hold = () => {
      holding = true;
      // taken back mid-gesture (scrolling up out of the long-form) the rest of
      // that gesture is swallowed, so the scene settles on its last section
      // before turning; the next gesture, or a jump's, counts
      wheelArmed = false;
      touchArmed = false;
      queued = null;
      observer?.enable();
    };
    const release = () => {
      holding = false;
      observer?.disable();
    };

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

      const settle = gsap.delayedCall(SETTLE_DELAY_SECONDS, () => {
        if (!holding || turn?.isActive()) return;
        if (Math.abs(sceneTrigger.getVelocity()) >= REST_VELOCITY) {
          settle.restart(true);
          return;
        }
        const y = seat.get();
        const top = snapTo(y, layout);
        if (Math.abs(top - y) >= 1) turnTo(top, SETTLE_SECONDS);
      }).pause();

      const sceneTrigger = ScrollTrigger.create({
        trigger: sceneEl,
        start: "top top",
        end: "bottom bottom",
        onRefresh: (self) => {
          const sections = Array.from(sceneEl.querySelectorAll<HTMLElement>(SECTIONS));
          layout = { tops: sections.map(documentTop), end: self.end };
          sync();
        },
        onUpdate: () => settle.restart(true),
      });

      // a finger drag on a touch device: one turn per press, the drag prevented
      observer = Observer.create({
        type: "touch",
        tolerance: PAGE_TOLERANCE,
        preventDefault: true,
        onPress: () => {
          touchArmed = true;
        },
        // a finger dragged up asks for what is below: onward
        onUp: (self) => touchGesture(1, self.deltaY),
        onDown: (self) => touchGesture(-1, self.deltaY),
      });
      observer.disable();
      sync();
    });

    // hold only while the *native* position is in the scene: that is where the
    // wheel's own writes land, ahead of the smoother's lerp
    function sync() {
      const inside = inScene(window.scrollY, layout);
      if (inside && !holding) hold();
      else if (!inside && holding) release();
    }
    window.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      window.removeEventListener("scroll", sync);
      window.removeEventListener("wheel", onWheel);
      turn?.kill();
      observer?.kill();
      ctx.revert();
      smooth?.dispose();
    };
  }, [wrapper, content, scene, held, reducedMotion]);
}
