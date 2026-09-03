import { useEffect, useLayoutEffect } from "react";

import { useAppStore } from "@/state/appStore";
import { revealTargets } from "@/state/revealTargets";
import { riseHeroHeadline } from "./heroRise";
import { buildNavReveal, collectNavReveal } from "./navReveal";
import { fadeParallaxFromInk, parallaxLayers } from "./restingFade";
import { SPLASH_HEADLINE } from "./splashComposition";
import { removeStaticSplash } from "./staticSplashDom";

/** the hero's h1, as HeroStop registered it (state/revealTargets.ts) */
function heroHeadline(): HTMLElement | null {
  return revealTargets("headline").find((el): el is HTMLElement => el instanceof HTMLElement) ?? null;
}

/**
 * The reveals around the splash, off the store: the reduced-motion fade from
 * ink (no splash mounts there), the nav's unfurl and the headline's settle
 * once the intro has played, and the static splash's removal in any session
 * the splash is not up in. Every target comes off the reveal registry; the
 * policy itself — whether the splash mounts — was decided at init
 * (app/initApp.ts, features/intro/introPolicy.ts). The preference can flip
 * mid-session (state/syncReducedMotion.ts): a flip to reduced motion while
 * the splash is up brings the store's intro down (appStore.setReducedMotion),
 * so in one commit App unmounts IntroSplash (its controller's dispose jumps
 * an in-flight handoff to its end), the static splash leaves, and the page
 * opens from ink here as a reduced-motion session does.
 */
export function useIntroReveals(): void {
  const intro = useAppStore((s) => s.intro);
  const introPlayed = useAppStore((s) => s.introPlayed);
  const reducedMotion = useAppStore((s) => s.reducedMotion);

  // no splash for reduced motion: the page still opens from ink with a short
  // fade. A preference flipped back mid-fade lands it: the scene stands at
  // rest with its opacity CSS's again, not caught half-way
  useEffect(() => {
    if (!reducedMotion) return;
    const fade = fadeParallaxFromInk(parallaxLayers());
    return () => {
      fade?.progress(1).kill();
    };
  }, [reducedMotion]);

  // the handoff has landed (introMachine.ts reports it through the store as
  // introPlayed): the nav unfurls from its mark and the hero headline
  // arrives, in the commit that drops the splash and the .intro-pending
  // class — before the first paint without the splash, so nothing flashes
  // into place first, and after that class is gone, since the nav's glass
  // tweens from clear to whatever its classes say at that moment. When the
  // splash carried the headline (#107) the hero's own h1 — hidden until now,
  // in the same box — settles from where the handoff lifted it; otherwise it
  // rises from below
  useLayoutEffect(() => {
    if (!introPlayed) return;
    const nav = buildNavReveal(collectNavReveal());
    const hero = riseHeroHeadline(heroHeadline(), 0, SPLASH_HEADLINE ? "settle" : "rise");
    return () => {
      nav.kill();
      hero?.revert();
    };
  }, [introPlayed]);

  // index.html carries the splash as static markup from first paint, and
  // IntroSplash adopts it as it stands. It leaves here, and only here: in
  // the commit that unmounts the splash once the handoff has landed, and at
  // once in a session the intro does not play in (its own inline script
  // already has, unless the two policies somehow disagreed)
  useLayoutEffect(() => {
    if (!intro) removeStaticSplash();
  }, [intro]);
}
