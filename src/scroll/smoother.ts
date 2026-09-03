import { ScrollSmoother } from "gsap/ScrollSmoother";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { gsap } from "@/lib/gsap";
import { seam } from "@/state/seam";
import { JUMP_EASE, SMOOTH_SECONDS } from "@/theme/motion";
import type { ScrollDriver } from "./position";

// the smoother needs ScrollTrigger (and isTouchOnly reads its verdict);
// registering again elsewhere is a no-op
gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

/** marks <html> while the smoother drives, so the CSS can hide the native scrollbar */
export const SMOOTH_SCROLL_ATTR = "data-smooth-scroll";

export type SmootherPolicyInputs = {
  /** the visitor prefers reduced motion */
  reducedMotion: boolean;
  /** a touch-only device (no hover, coarse pointer) */
  touch: boolean;
};

export type SmootherOptions = {
  smooth: number;
  smoothTouch: false;
};

/**
 * Whether to smooth at all, and how. Pure. Null means native scroll: under
 * reduced motion, and on touch-only devices, where the momentum scroll is
 * already the glide we want and the transform would only get in its way.
 */
export function smootherOptions({ reducedMotion, touch }: SmootherPolicyInputs): SmootherOptions | null {
  if (reducedMotion || touch) return null;
  return { smooth: SMOOTH_SECONDS, smoothTouch: false };
}

/** a touch-only device, by gsap's own reckoning (hover: none / pointer: coarse) */
export function isTouchOnly(): boolean {
  return ScrollTrigger.isTouch === 1;
}

/** an eased jump's length: half a second for a hop, up to 1.4 s across the page */
export function jumpDuration(distance: number): number {
  return Math.min(1.4, 0.5 + Math.abs(distance) / 6000);
}

/** the slice of ScrollSmoother this module drives; a fake stands in for tests */
export type SmootherLike = {
  scrollTop(): number;
  scrollTo(top: number, smooth: boolean): void;
  scrollTrigger: { animation?: { progress(): number; progress(value: number): unknown } };
};

/**
 * Clear the smoother's stale proxy flag after something has written its
 * scrollTop (a ScrollTrigger snap, an eased jump). ScrollTrigger rounds the
 * values it writes, so a tween's last two frames write the same pixel; the
 * second write sets ScrollSmoother's private isProxyScrolling with no update
 * left to clear it, and the next lone scroll event (a wheel notch, a
 * window.scrollTo) is consumed by that flag: the content freezes in place
 * until another event comes. The flag is only cleared inside the main
 * trigger's animation onUpdate, so nudge that animation by an invisible
 * amount to run it. Harmless when the flag is already clear.
 */
export function settleSmoother({ scrollTrigger }: SmootherLike): void {
  const animation = scrollTrigger.animation;
  if (!animation) return;
  const p = animation.progress();
  animation.progress(p < 0.5 ? p + 1e-6 : p - 1e-6);
}

/**
 * The page's scroll driver over a smoother. An eased jump tweens the
 * smoother's own scrollTop — which places the content every frame — rather
 * than ScrollSmoother.scrollTo(top, true), which only moves the native scroll
 * and lets the lerp follow: right after a ScrollTrigger snap the smoother can
 * swallow that single scroll event and freeze the content in place.
 */
export function smoothDriver(smoother: SmootherLike): ScrollDriver {
  return {
    scrollTop: () => smoother.scrollTop(),
    scrollTo(top, smooth) {
      if (!smooth) {
        smoother.scrollTo(top, false);
        return;
      }
      const done = () => {
        window.removeEventListener("wheel", stop);
        settleSmoother(smoother);
      };
      const tween = gsap.to(smoother, {
        scrollTop: top,
        duration: jumpDuration(top - smoother.scrollTop()),
        ease: JUMP_EASE,
        overwrite: "auto",
        onComplete: done,
        onInterrupt: done,
      });
      // the wheel takes the page back: a jump must never fight the reader
      const stop = () => tween.kill();
      window.addEventListener("wheel", stop, { once: true, passive: true });
    },
  };
}

/**
 * A running smoother, as the rest of the page sees it. The driver lives here,
 * on the handle — not in a module singleton — so a StrictMode double mount
 * or a second root never overwrites another's, and whoever holds the handle
 * holds its driver (useSmoothScroll.ts hands it out).
 */
export type SmoothScroll = {
  /** the page's scroll driver, over this smoother */
  driver: ScrollDriver;
  /** the content moves by transform (as opposed to native scrolling under a no-op smoother) */
  transforms: boolean;
  /** an outside write has landed on the smoother (a page turn): clear its stale flag */
  settle(): void;
  /** kill an in-flight eased jump: something else takes the scroll */
  interrupt(): void;
  dispose(): void;
};

/**
 * Create the smoother over `wrapper`/`content` when the policy allows one,
 * and hang the instant scroll the screenshot helper looks for on the page's
 * seam (`window.__gcc.scrollTo`, state/seam.ts). The returned dispose undoes
 * all of it.
 */
export function createSmoothScroll(
  wrapper: HTMLElement,
  content: HTMLElement,
  inputs: SmootherPolicyInputs,
): SmoothScroll | null {
  const options = smootherOptions(inputs);
  if (!options) return null;
  const smoother = ScrollSmoother.create({ wrapper, content, ...options });
  const settle = () => settleSmoother(smoother);
  const interrupt = () => gsap.killTweensOf(smoother);
  seam().scrollTo = (top) => {
    interrupt(); // an in-flight jump would keep writing over it
    smoother.scrollTo(top, false);
    settle();
  };
  document.documentElement.setAttribute(SMOOTH_SCROLL_ATTR, "");
  return {
    driver: smoothDriver(smoother),
    transforms: smoother.smooth() > 0,
    settle,
    interrupt,
    dispose() {
      document.documentElement.removeAttribute(SMOOTH_SCROLL_ATTR);
      delete seam().scrollTo;
      smoother.kill();
    },
  };
}

/**
 * The scene's sticky layers (canvas, chrome) under a smoother that transforms
 * the content: CSS sticky is inert inside a transform, so while the smoother
 * drives they are held by a scrubbed translate over the scene instead — the
 * same motion, as a transform: travel with the scroll until the layer's
 * bottom meets the scene's bottom, then leave with the last section. Returns
 * the function that lets them go.
 */
export function holdStickyLayers(scene: HTMLElement, layers: readonly HTMLElement[]): () => void {
  const ctx = gsap.context(() => {
    for (const el of layers) {
      const travel = () => scene.offsetHeight - el.offsetHeight;
      gsap.to(el, {
        y: travel,
        ease: "none",
        scrollTrigger: { trigger: scene, start: "top top", end: () => `+=${travel()}`, scrub: true, invalidateOnRefresh: true },
      });
    }
  });
  return () => ctx.revert();
}
