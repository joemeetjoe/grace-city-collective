import { useMemo } from "react";

import DotRail from "@/nav/DotRail";
import { STACK } from "@/theme/layerSplit";
import SiteNav from "@/nav/SiteNav";
import { sectionIds } from "@/content/site";
import { useSite } from "@/content/useSite";
import { jumpTo } from "./jump";
import HomePage from "./HomePage";
import { useSceneLayers } from "./useSceneLayers";
import { useSceneLoading } from "./useSceneLoading";
import IntroSplash from "@/intro/IntroSplash";
import { useIntroGate } from "@/intro/useIntroGate";
import { useDeviceProfile } from "@/device/useDeviceProfile";
import { sectionMarkers } from "@/scroll/markers";
import { useActiveSection } from "@/scroll/useActiveSection";
import { useSmoothScroll } from "@/scroll/useSmoothScroll";

/**
 * the shell: the splash, the fixed chrome (nav, dot rail), and the smoother's
 * wrapper/content pair. The page itself renders inside the content — the seam
 * a router outlet would occupy if the site ever grows past one page.
 */
export default function App() {
  const {
    parallaxRef,
    frameRef,
    frontRef,
    frontCanvasRef,
    sceneRef,
    wrapperRef,
    contentRef,
    held,
    sceneInView,
    frameHeight,
  } = useSceneLayers();
  const { intro, reducedMotion, finishIntro } = useIntroGate(parallaxRef);
  const { fallback, tier } = useDeviceProfile(reducedMotion);
  const { ready, progress, markReady, reportProgress } = useSceneLoading();
  useSmoothScroll(
    { wrapper: wrapperRef, content: contentRef, scene: sceneRef, held },
    reducedMotion,
  );

  const site = useSite();
  // which section is under the viewport's midpoint: one state, read by the
  // nav links and the dot rail alike
  const ids = useMemo(() => sectionIds(site), [site]);
  const markers = useMemo(() => sectionMarkers(site), [site]);
  const activeId = useActiveSection(ids);

  return (
    <div
      className="relative bg-ink font-sans text-cream"
      data-intro-pending={intro ? "" : undefined}
    >
      {intro && (
        <IntroSplash ready={ready} progress={progress} onDone={finishIntro} />
      )}

      {/* the nav outlives the scene: fixed for the whole page (SiteNav) */}
      <SiteNav activeId={activeId} sceneInView={sceneInView} />

      {/* the section dots, fixed outside the smoother's content like the nav,
          and stacked with it so section copy never covers a dot */}
      <DotRail
        markers={markers}
        activeId={activeId}
        onNavigate={jumpTo}
        className={STACK.nav}
      />

      {/* everything that scrolls lives in the smoother's content; the wrapper
          becomes its fixed viewport when the smoother is on (src/scroll) */}
      <div id="smooth-wrapper" ref={wrapperRef}>
        <div id="smooth-content" ref={contentRef}>
          <HomePage
            intro={intro}
            reducedMotion={reducedMotion}
            fallback={fallback}
            tier={tier}
            frameHeight={frameHeight}
            markReady={markReady}
            reportProgress={reportProgress}
            parallaxRef={parallaxRef}
            frontRef={frontRef}
            frontCanvasRef={frontCanvasRef}
            frameRef={frameRef}
            sceneRef={sceneRef}
          />
        </div>
      </div>
    </div>
  );
}
