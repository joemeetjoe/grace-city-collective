import type { RefObject } from "react";

import CornerOrnaments, {
  FRAME_ARM,
  FRAME_INSET,
} from "@/ui/CornerOrnaments";
import { STACK } from "@/theme/layerSplit";
import { PentecostParallax, StaticPoster, vignetteCss } from "@/engine";
import { useSite } from "@/content/useSite";
import Beliefs from "@/features/longform/Beliefs";
import Devotions from "@/features/longform/Devotions";
import Faq from "@/features/longform/Faq";
import Messages from "@/features/longform/Messages";
import SiteFooter from "@/features/longform/SiteFooter";
import { IntroPendingContext, ReducedMotionContext } from "./contexts";
import HeroLockup from "@/features/stops/HeroLockup";
import Scene from "@/features/stops/Scene";
import type { Tier } from "@/device/tier";

/** the scene frame's corners: the G mark's box, rounded top-left and bottom-right only */
const FRAME_CORNERS =
  "rounded-tl-[clamp(48px,7vw,110px)] rounded-br-[clamp(48px,7vw,110px)]";

export type HomePageProps = {
  intro: boolean;
  reducedMotion: boolean;
  fallback: boolean;
  tier: Tier;
  frameHeight: number | null;
  markReady: () => void;
  reportProgress: (loaded: number, total: number) => void;
  parallaxRef: RefObject<HTMLDivElement | null>;
  frontRef: RefObject<HTMLDivElement | null>;
  frontCanvasRef: RefObject<HTMLCanvasElement | null>;
  frameRef: RefObject<HTMLDivElement | null>;
  sceneRef: RefObject<HTMLDivElement | null>;
};

/**
 * the page itself: the scene and the long-form that follows it. Everything
 * inside the smoother's content lives here; the shell (App) keeps the nav,
 * the splash, and the smoother wiring.
 */
export default function HomePage({
  intro,
  reducedMotion,
  fallback,
  tier,
  frameHeight,
  markReady,
  reportProgress,
  parallaxRef,
  frontRef,
  frontCanvasRef,
  frameRef,
  sceneRef,
}: HomePageProps) {
  const site = useSite();

  return (
    <>
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
            <StaticPoster onReady={markReady} />
          ) : (
            <PentecostParallax
              layerSpread={1.25}
              tier={tier}
              frontCanvas={frontCanvasRef}
              onReady={markReady}
              onProgress={reportProgress}
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
            <ReducedMotionContext.Provider value={reducedMotion}>
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
    </>
  );
}
