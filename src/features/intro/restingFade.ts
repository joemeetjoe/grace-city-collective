import { gsap } from "@/lib/gsap";
import { FADE_EASE, RESTING_FADE_SECONDS } from "@/theme/motion";
import { revealTargets } from "@/state/revealTargets";

/**
 * The scene's canvases — the back one under the type and the front one over
 * it (layerSplit.ts), whichever are rendered — which every fade from ink
 * must move together; the page registers them (app/HomePage.tsx)
 */
export function parallaxLayers(): HTMLElement[] {
  return revealTargets("parallax").filter((el): el is HTMLElement => el instanceof HTMLElement);
}

/**
 * When the splash never mounts (reduced motion), the page still opens from
 * ink: the parallax fades up in place, then hands its opacity back to CSS.
 */
export function fadeParallaxFromInk(parallax: HTMLElement | HTMLElement[] | null): gsap.core.Tween | null {
  const targets = ([] as (HTMLElement | null)[]).concat(parallax).filter((el): el is HTMLElement => el !== null);
  if (!targets.length) return null;
  return gsap.fromTo(
    targets,
    { opacity: 0 },
    { opacity: 1, duration: RESTING_FADE_SECONDS, ease: FADE_EASE, clearProps: "opacity" },
  );
}
