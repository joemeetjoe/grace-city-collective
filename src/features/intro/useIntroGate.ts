import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

import { useAppStore } from "@/state/appStore";
import { HERO_HEADLINE, riseHeroHeadline } from "./heroRise";
import { buildNavReveal, collectNavReveal } from "./navReveal";
import { fadeParallaxFromInk } from "./restingFade";
import { SPLASH_HEADLINE } from "./splashComposition";
import { removeStaticSplash } from "./staticSplashDom";

/**
 * The reveals around the splash, off the store's `intro` and `reducedMotion`
 * (decided once per mount, app/initApp.ts): the reduced-motion fade from
 * ink, the nav's unfurl and the headline's rise after a played intro, and
 * the static splash's removal when none plays.
 */
export function useIntroGate(parallax: RefObject<HTMLDivElement | null>): void {
  const intro = useAppStore((s) => s.intro);
  const reducedMotion = useAppStore((s) => s.reducedMotion);

  // no splash for reduced motion: the page still opens from ink with a short fade
  useEffect(() => {
    if (!reducedMotion) return;
    const fade = fadeParallaxFromInk(parallax.current);
    return () => {
      fade?.kill();
    };
  }, [reducedMotion, parallax]);

  // after a played intro, the nav unfurls from its mark and the hero headline
  // arrives, the moment the splash's mark has landed: before the first paint
  // without the splash, so nothing flashes into place first. When the splash
  // carried the headline (#107) the hero's own h1 — hidden until now, in the
  // same box — settles from where the handoff lifted it; otherwise it rises
  // from below. A session that skips the intro renders everything at rest
  const played = useRef(intro);
  useLayoutEffect(() => {
    if (!played.current || intro) return;
    const nav = buildNavReveal(collectNavReveal());
    const hero = riseHeroHeadline(
      document.querySelector<HTMLElement>(HERO_HEADLINE),
      0,
      SPLASH_HEADLINE ? "settle" : "rise",
    );
    return () => {
      nav.kill();
      hero?.revert();
    };
  }, [intro]);

  // index.html carries the splash as static markup from first paint; a
  // session the intro does not play in drops it here (its own inline script
  // already has, unless the two policies somehow disagreed)
  useLayoutEffect(() => {
    if (!intro) removeStaticSplash();
  }, [intro]);
}
