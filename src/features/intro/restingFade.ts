import { gsap } from "@/lib/gsap";

/** the short fade that stands in for the intro under reduced motion */
export const RESTING_FADE_SECONDS = 0.4;

/**
 * The scene's canvases — the back one under the type and the front one over
 * it (layerSplit.ts) — which every fade from ink must move together
 */
export const PARALLAX_LAYERS = "[data-parallax], [data-parallax-front]";

export function parallaxLayers(root: ParentNode = document): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(PARALLAX_LAYERS));
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
    { opacity: 1, duration: RESTING_FADE_SECONDS, ease: "power2.out", clearProps: "opacity" },
  );
}
