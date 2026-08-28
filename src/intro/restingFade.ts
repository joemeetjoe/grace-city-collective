import { gsap } from "@/lib/gsap";

/** the short fade that stands in for the intro under reduced motion */
export const RESTING_FADE_SECONDS = 0.4;

/**
 * When the splash never mounts (reduced motion), the page still opens from
 * ink: the parallax fades up in place, then hands its opacity back to CSS.
 */
export function fadeParallaxFromInk(parallax: HTMLElement | null): gsap.core.Tween | null {
  if (!parallax) return null;
  return gsap.fromTo(
    parallax,
    { opacity: 0 },
    { opacity: 1, duration: RESTING_FADE_SECONDS, ease: "power2.out", clearProps: "opacity" },
  );
}
