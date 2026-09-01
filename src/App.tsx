import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import CornerOrnaments, {
  FRAME_ARM,
  FRAME_INSET,
} from "@/components/CornerOrnaments";
import DotRail from "@/components/DotRail";
import { STACK } from "@/components/layerSplit";
import SiteNav from "@/components/SiteNav";
import PentecostParallax from "@/components/PentecostParallax";
import StaticPoster from "@/components/StaticPoster";
import { useInView } from "@/components/useInView";
import { vignetteCss } from "@/components/vignette";
import { sectionIds } from "@/content/site";
import { useSite } from "@/content/useSite";
import Beliefs from "@/longform/Beliefs";
import Devotions from "@/longform/Devotions";
import Faq from "@/longform/Faq";
import Messages from "@/longform/Messages";
import SiteFooter from "@/longform/SiteFooter";
import { IntroPendingContext, ReducedMotionContext } from "@/app/contexts";
import { jumpTo } from "@/app/jump";
import HeroLockup from "@/stops/HeroLockup";
import Scene from "@/stops/Scene";
import { HERO_HEADLINE, riseHeroHeadline } from "@/intro/heroRise";
import IntroSplash from "@/intro/IntroSplash";
import { readPolicyInputs, shouldPlayIntro } from "@/intro/introPolicy";
import { removeStaticSplash } from "@/intro/staticSplashDom";
import { buildNavReveal, collectNavReveal } from "@/intro/navReveal";
import { fadeParallaxFromInk } from "@/intro/restingFade";
import { useBelowLg } from "@/layout/breakpoint";
import { useViewportHeight } from "@/layout/viewportHeight";
import { detectWebgl, shouldUseStaticFallback } from "@/device/fallback";
import { readSaveData, readTierInputs, tierFor } from "@/device/tier";
import { sectionMarkers } from "@/scroll/markers";
import { useActiveSection } from "@/scroll/useActiveSection";
import { useSmoothScroll } from "@/scroll/useSmoothScroll";

/** the scene frame's corners: the G mark's box, rounded top-left and bottom-right only */
const FRAME_CORNERS =
  "rounded-tl-[clamp(48px,7vw,110px)] rounded-br-[clamp(48px,7vw,110px)]";

export default function App() {
  // decided once per mount: once per session, and never under reduced motion
  const [policy] = useState(() => readPolicyInputs());
  const [intro, setIntro] = useState(() => shouldPlayIntro(policy));
  // the still poster stands in for the scene: no WebGL, reduced motion, or Save-Data
  const [fallback] = useState(() =>
    shouldUseStaticFallback({
      webgl: detectWebgl(),
      reducedMotion: policy.reducedMotion,
      saveData: readSaveData(),
    }),
  );
  const [tier] = useState(() => tierFor(readTierInputs()));
  const [ready, setReady] = useState(false);
  // the textures' share so far, for the splash's loading trace
  const [progress, setProgress] = useState(0);
  const parallaxRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);
  const frontCanvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  // the smoother's sticky stand-ins — every sticky layer of the scene, so the
  // front canvas and the frame ride with the back canvas; a stable list so
  // the hook runs once
  const [held] = useState(() => [parallaxRef, frontRef, frameRef]);
  useSmoothScroll(
    { wrapper: wrapperRef, content: contentRef, scene: sceneRef, held },
    policy.reducedMotion,
  );

  // no splash for reduced motion: the page still opens from ink with a short fade
  useEffect(() => {
    if (!policy.reducedMotion) return;
    const fade = fadeParallaxFromInk(parallaxRef.current);
    return () => {
      fade?.kill();
    };
  }, [policy.reducedMotion]);

  // once the scene has scrolled away the nav sits over long-form text, so it
  // takes an ink backdrop to stay legible
  const sceneInView = useInView(sceneRef, { initial: true });

  // below lg the frame's dvh steps as the URL bar moves; a measured px
  // height lets the layer's transition glide between the steps instead
  const frameHeight = useViewportHeight(useBelowLg());

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
        <IntroSplash
          ready={ready}
          progress={progress}
          onDone={() => setIntro(false)}
        />
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
          {/* the scene: a sticky canvas under six sections (one viewport each
          on desktop, as tall as their words below lg), stacked in one grid
          cell so the wrapper is exactly as tall as the sections.
          A sticky child can never leave its container, so the canvas and the
          chrome scroll away with the last section like a final panel, and
          the long-form follows on plain ink. (No negative margins here: a
          sticky element's margin box is what gets constrained, so -mb-[100svh]
          would let it linger one viewport into the long-form.) While the
          smoother transforms the content the sticky is inert and
          useSmoothScroll holds the sticky layers with a scrubbed translate.
          A held layer is transformed, so it is a stacking context of its
          own: each carries one step of STACK (layerSplit.ts). */}
          <div ref={sceneRef} data-scene="" className="relative grid grid-cols-[minmax(0,1fr)]">
            {/* sticky, not fixed: it stays put while the sections scroll over it.
            lvh, not svh: on a phone the URL bar retracts as the reader scrolls
            and the viewport grows from svh to lvh, so an svh canvas leaves a
            strip of bare ink at the foot of the screen with the next stop's
            card rolling up through it. lvh always covers; the overdraw hides
            under the bar while it is shown. Not dvh: that resizes the canvas
            all the way through the bar's transition, and onResize rebuilds
            every layer's geometry (PentecostParallax.tsx) */}
            <div
              ref={parallaxRef}
              data-parallax=""
              className={`sticky top-0 ${STACK.back} col-start-1 row-start-1 h-[100lvh] self-start overflow-hidden`}
            >
              {fallback ? (
                <StaticPoster onReady={() => setReady(true)} />
              ) : (
                <PentecostParallax
                  layerSpread={1.25}
                  tier={tier}
                  frontCanvas={frontCanvasRef}
                  onReady={() => setReady(true)}
                  onProgress={(loaded, total) =>
                    setProgress(total ? loaded / total : 0)
                  }
                />
              )}
              {/* the front canvas wears the same vignette in its shaders (vignette.ts) */}
              <div
                aria-hidden
                className="absolute inset-0"
                style={{ background: vignetteCss() }}
              />
            </div>

            {/* the front canvas: the floor, the two nearest apostles on the left
            and the embers, drawn from the same scene over the hero headline
            (layerSplit.ts). Transparent, and no pointer events */}
            {!fallback && (
              <div
                ref={frontRef}
                data-parallax-front=""
                className={`pointer-events-none sticky top-0 ${STACK.front} col-start-1 row-start-1 h-[100lvh] self-start overflow-hidden`}
              >
                <canvas
                  ref={frontCanvasRef}
                  aria-hidden
                  className="absolute inset-0 block h-full w-full"
                />
              </div>
            )}

            {/* stationary chrome above the front canvas: the lockup in the
            bottom-left corner (lg and up; below, it rides at the hero's foot),
            and the frame border in the G mark's shape — rounded top-left and
            bottom-right, square elsewhere.
            dvh, unlike the canvases: at svh the border closed 100px above
            the hero's foot on a phone once the URL bar retracted, and at lvh
            its bottom edge hung under the bar while it showed. dvh tracks
            the visible viewport through both states; resizing here is cheap
            (a border and the lockup, no canvas geometry), and on desktop
            dvh and lvh agree. Browsers step dvh in coarse jumps while the
            bar animates, so below lg the height is measured in px instead
            (layout/viewportHeight.ts) and the transition glides between the
            steps — dvh stands as the no-measure fallback */}
            <div
              ref={frameRef}
              className={`pointer-events-none sticky top-0 ${STACK.copy} col-start-1 row-start-1 h-[100dvh] self-start motion-safe:transition-[height] motion-safe:duration-200 motion-safe:ease-out`}
              style={frameHeight == null ? undefined : { height: `${frameHeight}px` }}
            >
              <HeroLockup at="chrome" />
              <div
                aria-hidden
                data-scene-frame=""
                className={`absolute inset-[clamp(9px,2.4vw,26px)] border border-cream/35 ${FRAME_CORNERS}`}
              />
              {/* not on a phone, where the lockup sits right in the bottom-left corner */}
              <CornerOrnaments
                arm={FRAME_ARM}
                inset={FRAME_INSET}
                shown={!intro}
                className="hidden md:block"
              />
            </div>

            {/* one camera waypoint per scene section: a viewport each on desktop,
            the words' own height below lg (see Scene). min-w-0 with the grid's
            minmax(0,1fr) column: a section's min-content can never widen the
            cell, and the sticky layers with it, past the viewport (#51) */}
            <div className="relative col-start-1 row-start-1 min-w-0">
              <IntroPendingContext.Provider value={intro}>
                <ReducedMotionContext.Provider value={policy.reducedMotion}>
                  {site.scene.map((s) => (
                    <Scene key={s.id} section={s} />
                  ))}
                </ReducedMotionContext.Provider>
              </IntroPendingContext.Provider>
            </div>
          </div>

          {/* long-form: ordinary scrolling on ink, no waypoints */}
          <div data-longform="" className="relative z-10 bg-ink">
            <Devotions />
            <Beliefs />
            <Faq />
            <Messages />
            <SiteFooter />
          </div>
        </div>
      </div>
    </div>
  );
}

