import { useEffect, useMemo, useState } from "react";

import DotRail from "@/features/nav/DotRail";
import { STACK } from "@/theme/classes";
import SiteNav from "@/features/nav/SiteNav";
import { sectionIds } from "@/content/site";
import { useSite } from "@/content/useSite";
import { initApp } from "./initApp";
import { useJump } from "./jump";
import { JumpProvider } from "./jumpContext";
import HomePage from "./HomePage";
import { useSceneLayers } from "./useSceneLayers";
import IntroSplash from "@/features/intro/IntroSplash";
import { useIntroGate } from "@/features/intro/useIntroGate";
import { sectionMarkers } from "@/scroll/markers";
import { useSmoothScroll } from "@/scroll/useSmoothScroll";
import { useAppStore } from "@/state/appStore";
import { syncTier } from "@/state/syncTier";

/**
 * the shell: the splash, the fixed chrome (nav, dot rail), and the smoother's
 * wrapper/content pair. The page itself renders inside the content — the seam
 * a router outlet would occupy if the site ever grows past one page.
 */
export default function App() {
  const site = useSite();
  const ids = useMemo(() => sectionIds(site), [site]);
  const markers = useMemo(() => sectionMarkers(site), [site]);
  // the store's state for this mount — the intro policy, the device's
  // verdicts — decided once, before anything below reads it (initApp.ts)
  useState(() => initApp(ids[0] ?? null));
  // of those, the tier stays live: the device's current one, as a fact (syncTier.ts)
  useEffect(syncTier, []);

  const {
    parallaxRef,
    frameRef,
    frontRef,
    frontCanvasRef,
    sceneRef,
    wrapperRef,
    contentRef,
    held,
    sections,
  } = useSceneLayers(ids);
  useIntroGate(parallaxRef);
  // the smoother, the paging, and the section watch that keeps the store's
  // activeId — which section is under the viewport's midpoint, read by the
  // nav links and the dot rail from the store
  const scroll = useSmoothScroll({ wrapper: wrapperRef, content: contentRef, scene: sceneRef, held, sections });
  const intro = useAppStore((s) => s.intro);
  const jump = useJump(scroll);

  return (
    <div
      // .intro-pending: while the splash is up the nav's pieces and the hero
      // headline wait unseen (index.css)
      className={`relative bg-ink font-sans text-cream${intro ? " intro-pending" : ""}`}
    >
      {intro && <IntroSplash />}

      {/* the fixed chrome's links jump through the page's scroll: the jump
          reaches them by context (jumpContext.tsx), the active section by the store */}
      <JumpProvider jump={jump}>
        {/* the nav outlives the scene: fixed for the whole page (SiteNav) */}
        <SiteNav />

        {/* the section dots, fixed outside the smoother's content like the nav,
            and stacked with it so section copy never covers a dot */}
        <DotRail markers={markers} className={STACK.nav} />
      </JumpProvider>

      {/* everything that scrolls lives in the smoother's content; the wrapper
          becomes its fixed viewport when the smoother is on (src/scroll).
          The content is the page's <main>: the one landmark, so every
          section sits inside a landmark (axe region, App.a11y.test.tsx) */}
      <div id="smooth-wrapper" ref={wrapperRef}>
        <main id="smooth-content" ref={contentRef}>
          <HomePage
            parallaxRef={parallaxRef}
            frontRef={frontRef}
            frontCanvasRef={frontCanvasRef}
            frameRef={frameRef}
            sceneRef={sceneRef}
            sections={sections}
            scroll={scroll}
          />
        </main>
      </div>
    </div>
  );
}
