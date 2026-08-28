import { gsap, ScrollSmoother, ScrollTrigger } from "@/lib/gsap";
import { installScrollDriver, type ScrollDriver } from "@/scroll/position";

declare global {
  interface Window {
    /** instant scroll through the smoother, for the screenshot helper (tools/shots) */
    __gccScrollTo?: (top: number) => void;
  }
}

/** seconds the smoothed position takes to catch up with the wheel */
export const SMOOTH_SECONDS = 1.1;

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

export const JUMP_EASE = "power2.inOut";

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

export type SmoothScroll = {
  smoother: ScrollSmoother;
  /** the content moves by transform (as opposed to native scrolling under a no-op smoother) */
  transforms: boolean;
  dispose(): void;
};

/**
 * Create the smoother over `wrapper`/`content` when the policy allows one,
 * install it as the page's scroll driver and expose the instant scroll the
 * screenshot helper looks for. The returned dispose undoes all of it.
 */
export function createSmoothScroll(
  wrapper: HTMLElement,
  content: HTMLElement,
  inputs: SmootherPolicyInputs,
): SmoothScroll | null {
  const options = smootherOptions(inputs);
  if (!options) return null;
  const smoother = ScrollSmoother.create({ wrapper, content, ...options });
  installScrollDriver(smoothDriver(smoother));
  window.__gccScrollTo = (top) => {
    gsap.killTweensOf(smoother); // an in-flight jump would keep writing over it
    smoother.scrollTo(top, false);
    settleSmoother(smoother);
  };
  document.documentElement.setAttribute(SMOOTH_SCROLL_ATTR, "");
  return {
    smoother,
    transforms: smoother.smooth() > 0,
    dispose() {
      document.documentElement.removeAttribute(SMOOTH_SCROLL_ATTR);
      delete window.__gccScrollTo;
      installScrollDriver(null);
      smoother.kill();
    },
  };
}
