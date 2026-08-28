import { Flip, gsap } from "@/lib/gsap";

export const HANDOFF_SECONDS = 0.8;
export const HANDOFF_EASE = "power3.inOut";

/**
 * Where the splash sits once the hero lockup has taken over: under the
 * stationary chrome (z-20) so the travelling lockup shows through the fading
 * ink, over the sections (z-10) so they fade up with the parallax.
 */
export const HANDOFF_Z_INDEX = 15;

export type HandoffContext = {
  /** the splash root; its ink fades to transparent */
  root: HTMLElement;
  /** the hero's lockup wrapper (`[data-hero-lockup]`), if rendered */
  hero: HTMLElement | null;
  /** the parallax scene wrapper (`[data-parallax]`), if rendered */
  parallax: HTMLElement | null;
  onComplete: () => void;
};

const LOCKUP = '[data-lockup=""]';

function flipParts(lockup: Element): Element[] {
  return [lockup, ...lockup.querySelectorAll("[data-flip-id]")];
}

/**
 * The handoff: the hero lockup takes over from the splash lockup via Flip —
 * travelling from the centred title card to its bottom-left slot and size —
 * while the splash's ink fades out and the parallax fades up underneath.
 */
export function buildHandoff({ root, hero, parallax, onComplete }: HandoffContext): gsap.core.Timeline {
  const tl = gsap.timeline({ onComplete });
  const from = root.querySelector(LOCKUP);
  const to = hero?.querySelector(LOCKUP) ?? null;

  if (from && to) {
    const fromParts = flipParts(from);
    const toParts = flipParts(to);
    const state = Flip.getState(fromParts);
    const carried = new Set(toParts.map((el) => el.getAttribute("data-flip-id")));
    for (const part of fromParts.slice(1)) {
      if (carried.has(part.getAttribute("data-flip-id"))) {
        // the hero copy takes over from here
        gsap.set(part, { opacity: 0 });
      } else {
        // no counterpart in the hero (the script drops on small screens): fade in place
        tl.to(part, { opacity: 0, duration: HANDOFF_SECONDS / 2, ease: "power2.out" }, 0);
      }
    }
    gsap.set(root, { zIndex: HANDOFF_Z_INDEX });
    tl.add(
      Flip.from(state, {
        targets: toParts,
        duration: HANDOFF_SECONDS,
        ease: HANDOFF_EASE,
        scale: true,
        nested: true,
        absolute: true,
        onEnter: (els) => gsap.fromTo(els, { opacity: 0 }, { opacity: 1, duration: HANDOFF_SECONDS, ease: "power2.in" }),
      }),
      0,
    );
  }

  tl.to(root, { opacity: 0, duration: HANDOFF_SECONDS, ease: HANDOFF_EASE }, 0);
  if (parallax) tl.to(parallax, { opacity: 1, duration: HANDOFF_SECONDS, ease: HANDOFF_EASE }, 0);
  return tl;
}
