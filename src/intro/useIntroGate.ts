import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

import { HERO_HEADLINE, riseHeroHeadline } from "./heroRise";
import { readPolicyInputs, shouldPlayIntro } from "./introPolicy";
import { buildNavReveal, collectNavReveal } from "./navReveal";
import { fadeParallaxFromInk } from "./restingFade";
import { removeStaticSplash } from "./staticSplashDom";

export type IntroGate = {
  intro: boolean;
  reducedMotion: boolean;
  finishIntro: () => void;
};

/** whether the splash plays this session, and the reveals that follow it */
export function useIntroGate(
  parallax: RefObject<HTMLDivElement | null>,
): IntroGate {
  // decided once per mount: once per session, and never under reduced motion
  const [policy] = useState(() => readPolicyInputs());
  const [intro, setIntro] = useState(() => shouldPlayIntro(policy));

  // no splash for reduced motion: the page still opens from ink with a short fade
  useEffect(() => {
    if (!policy.reducedMotion) return;
    const fade = fadeParallaxFromInk(parallax.current);
    return () => {
      fade?.kill();
    };
  }, [policy.reducedMotion, parallax]);

  // after a played intro, the nav unfurls from its mark and the hero headline
  // rises, the moment the splash's mark has landed: before the first paint
  // without the splash, so nothing flashes into place first. A session that
  // skips the intro renders everything at rest
  const played = useRef(intro);
  useLayoutEffect(() => {
    if (!played.current || intro) return;
    const nav = buildNavReveal(collectNavReveal());
    const hero = riseHeroHeadline(
      document.querySelector<HTMLElement>(HERO_HEADLINE),
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

  const finishIntro = useCallback(() => setIntro(false), []);

  return { intro, reducedMotion: policy.reducedMotion, finishIntro };
}
