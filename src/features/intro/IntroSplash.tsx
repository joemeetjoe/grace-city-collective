import { useLayoutEffect } from "react";

import { chromeWords } from "@/content/site";
import { useSite } from "@/content/useSite";
import { useAppStore } from "@/state/appStore";
import { createIntroController } from "./introMachine";
import { SPLASH_HEADLINE_ATTR } from "./staticSplash";
import { adoptStaticSplash } from "./staticSplashDom";

export type IntroSplashProps = {
  /** the controller factory — injectable so tests can scrub the trace and the handoff */
  create?: typeof createIntroController;
};

/**
 * The splash's parts, by the hooks the static markup carries (staticSplash.ts):
 * the one place the intro looks anything up by attribute. The splash is HTML
 * built into index.html, not rendered, so nothing could have handed these
 * over as refs — and the lookup stays inside the adopted root.
 */
function splashParts(root: HTMLElement) {
  return {
    mark: root.querySelector<SVGSVGElement>("[data-g-mark]"),
    rule: root.querySelector<SVGPathElement>("[data-g-mark-rule]"),
    headline: root.querySelector<HTMLElement>(`[${SPLASH_HEADLINE_ATTR}]`),
  };
}

/**
 * Full-screen intro on ink that doubles as the loading screen: the G mark
 * fills the viewport and its red rule draws itself around the box as the
 * textures arrive. Once they are in (and the rule has had its minimum run,
 * or the visitor skipped), the rule closes and the mark travels into the nav
 * while the scene fades up underneath. All of that is the intro machine's
 * (introMachine.ts): it reads the textures' progress and the ready signal
 * off the store, and its handoff's landing finishes the intro there, which
 * unmounts this.
 *
 * The splash stands in index.html as static markup (staticSplash.ts) from
 * the page's first paint, the hero headline included, set in the hero's box
 * by the inline head style (#107). This component renders nothing of its
 * own: before paint it adopts that markup as it stands and hands the root
 * and its parts to the controller — the headline is the page's LCP element,
 * and an h1 re-created at mount would be a new, later candidate. At the
 * handoff the hero's own h1, hidden while the intro is pending, takes over
 * without a pixel moving, and the adopted root leaves with the splash
 * (useIntroReveals.ts).
 *
 * The one thing rendered here is for assistive tech (#130): the adopted
 * splash is aria-hidden and the page under it inert (App.tsx), so a status
 * line, unseen, is the whole of what a screen reader can reach while the
 * intro plays, and it says that any key skips it. The static splash paints
 * from the document; this line is inserted into it when React mounts — an
 * insertion into a live region, which is what a live region announces —
 * and it leaves with the splash.
 */
export default function IntroSplash({ create = createIntroController }: IntroSplashProps) {
  const site = useSite();
  useLayoutEffect(() => {
    const root = adoptStaticSplash();
    const controller = create({ root, ...splashParts(root), store: useAppStore, skipTarget: window });
    return controller.dispose;
  }, [create]);

  // the splash itself is the adopted static markup; only the hint renders here
  return (
    <p role="status" aria-live="polite" className="sr-only">
      {chromeWords(site).skipIntro}
    </p>
  );
}
