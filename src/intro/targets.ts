import type { IntroTargets } from "@/intro/timeline";

/** The animatable parts of a rendered Lockup, found by their data-lockup marks. */
export function introTargets(root: HTMLElement): IntroTargets {
  return {
    wordmark: root.querySelector<HTMLElement>('[data-lockup="wordmark"]')!,
    script: root.querySelector<SVGSVGElement>('[data-lockup="script"]'),
    seal: root.querySelector<SVGSVGElement>('[data-lockup="seal"]'),
  };
}
