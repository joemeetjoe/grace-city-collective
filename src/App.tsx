import {
  createContext,
  useContext,
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
import GatheringCalendar from "@/components/GatheringCalendar";
import GatheringMark from "@/components/GatheringMark";
import HouseTable from "@/components/HouseTable";
import SharedLife from "@/components/SharedLife";
import SowingMark from "@/components/SowingMark";
import { BUTTON_CORNERS, GLASS, GLASS_CORNERS } from "@/components/glass";
import GMark from "@/components/GMark";
import { BUTTON_LIFT, FOCUS_RING, LINK_SWEEP } from "@/components/interact";
import { STACK } from "@/components/layerSplit";
import Lockup from "@/components/Lockup";
import MobileNav from "@/components/MobileNav";
import NavLinks from "@/components/NavLinks";
import OrnateRule from "@/components/OrnateRule";
import ScriptureRefs from "@/components/ScriptureRefs";
import SmoothHeight from "@/components/SmoothHeight";
import PentecostParallax from "@/components/PentecostParallax";
import Reveal, { REVEAL_STAGGER_MS } from "@/components/Reveal";
import StaticPoster from "@/components/StaticPoster";
import WayIn from "@/components/WayIn";
import { useInTurn } from "@/components/useInTurn";
import { PLAY_MARGIN, useInView, type InViewOptions } from "@/components/useInView";
import { useInViewOnce } from "@/components/useInViewOnce";
import { vignetteCss } from "@/components/vignette";
import {
  GATHERING_MARKS,
  type GatheringMark as Mark,
  type SceneSection,
  sectionIds,
  type SiteContent,
  wayIn,
} from "@/content/site";
import { useSite } from "@/content/useSite";
import { HERO_HEADLINE, riseHeroHeadline } from "@/intro/heroRise";
import IntroSplash from "@/intro/IntroSplash";
import { readPolicyInputs, shouldPlayIntro } from "@/intro/introPolicy";
import { removeStaticSplash } from "@/intro/staticSplashDom";
import { buildNavReveal, collectNavReveal } from "@/intro/navReveal";
import { fadeParallaxFromInk } from "@/intro/restingFade";
import { useBelowLg } from "@/layout/breakpoint";
import { detectWebgl, shouldUseStaticFallback } from "@/scene/fallback";
import { readSaveData, readTierInputs, tierFor } from "@/scene/tier";
import { jumpTo as scrollJumpTo } from "@/scroll/jump";
import { sectionMarkers } from "@/scroll/markers";
import { getScrollDriver } from "@/scroll/position";
import { useActiveSection } from "@/scroll/useActiveSection";
import { useSmoothScroll } from "@/scroll/useSmoothScroll";

const serif = "[font-family:'Cormorant_Garamond',Georgia,serif]";
const gutter = "px-[clamp(20px,4.4vw,60px)]";
const kickerCls = "text-[11px] uppercase tracking-[0.28em] text-seal";
// a scene card's paragraphs below lg: the phone headline is ~30px to the
// desktop's ~48px, so 16px Geist (a big x-height, uniform strokes) out-weighs
// the hairline Cormorant beside it; a half-size down, more leading and a
// hair lighter on the variable axis restores the desktop's hierarchy
const PHONE_BODY = "max-lg:text-[14.5px] max-lg:leading-[1.6] max-lg:font-[380]";
// everything a scene section says sits between the canvases (layerSplit.ts),
// so the nearest figures cross it: a panel rises from behind them and rests
// with an edge tucked behind one, its words placed clear
const between = `relative ${STACK.between}`;

/** the ornamented rule that opens each long-form section, centred, in the seal's red */
const SEPARATOR =
  "mx-auto mb-[clamp(40px,6vh,72px)] w-[clamp(160px,24vw,320px)] text-seal";

/** how far outside a copy panel's edge its brackets sit */
const PANEL_BRACKET_OUT = "-10px";

/** how much of a copy panel must be on screen before its brackets come in */
const PANEL_ENTER_THRESHOLD = 0.45;

/**
 * When a stop's panel is shown, as `useInView` watches it. On desktop, once
 * most of it is on screen (its section is a viewport, so that is the turn of
 * the page). Below lg the sections are as tall as their words (#52), so the
 * next stop's panel can stand on screen before its own turn: there it is
 * shown while it is settled in the play band — enter and leave, so it fills
 * as it arrives and empties again once well past. Both start shown, so the
 * words are up until the observer says otherwise.
 */
const PANEL_SHOWN_DESKTOP: InViewOptions = {
  threshold: PANEL_ENTER_THRESHOLD,
  initial: true,
};
const PANEL_SHOWN_BELOW_LG: InViewOptions = {
  rootMargin: PLAY_MARGIN,
  initial: true,
};

/**
 * On a phone a stop's ornament plays the pointer's part a beat after its
 * rows have printed in (useInTurn), so its rest state — the program, the
 * empty table, the seed, the traced emblems — is seen first, as it is on a
 * desktop before the pointer arrives; the gathering emblems then light one
 * after the next, a beat apart.
 */
const ORNAMENT_LIT_AT_MS = 1200;
const EMBLEM_LIT_STEP_MS = 400;

/** whether the copy panel around a component is shown, for ornaments that come in with its brackets */
const PanelShownContext = createContext(true);

/** whether the reader prefers reduced motion: the stops' ornaments then rest, shown */
const ReducedMotionContext = createContext(false);

/** whether the splash is still up, for the hero's pieces that wait for the handoff */
const IntroPendingContext = createContext(false);

/** how much of a long-form section's opening rule must be on screen before it draws */
const RULE_DRAW_THRESHOLD = 0.5;

/** the filled call to action, in the seal's red: it lifts and glows under the pointer */
const SEAL_BUTTON = `${BUTTON_CORNERS} ${BUTTON_LIFT} ${FOCUS_RING} bg-seal text-cream hover:bg-seal-deep`;
/** the hollow call to action: a cream hairline that brightens, with a cream glow */
const GHOST_BUTTON = `${BUTTON_CORNERS} ${BUTTON_LIFT} ${FOCUS_RING} border border-cream/45 [--lift-glow:var(--color-cream)] hover:border-cream hover:bg-cream/10`;

/**
 * Where each stop's panel tucks behind the nearest figures (the front cuts
 * of layerSplit.ts): extra padding on that side, so the glass runs on under
 * the figure while the words stop short of it. Who crosses what, at rest:
 * who we are — the panel steps in from the gutter and the two near apostles
 * on the left stand over its right third; house churches — the right-hand apostle's head over the
 * bottom edge; gatherings — the two left apostles' heads over the lower-left
 * corner, the right-hand one over the lower-right (the space that clears
 * them is the calendar's column, its divider running under the heads); give — a hood over the
 * left edge, so the panel steps right and pads both sides to keep its words
 * centred (the left band holds the sown field, GiveSowing). Where a figure lands depends on both viewport axes — the
 * waypoints (PentecostParallax) fill the frame's height, and the lateral
 * budget clamps the frame's centre by its aspect — so the who-we-are and
 * gatherings tucks are linear fits in vw and vh to the figures' screen
 * positions measured at six sizes from 1280×720 to 2560×1440 (residuals
 * under 20px); who-we-are steps in from the gutter from 1440 up, and its
 * tuck is set per width range — the ranges are mutually exclusive because
 * Tailwind orders an arbitrary min-[] variant before lg, so a plain
 * min-[1440px]:[--tuck:…] would lose to lg:[--tuck:…]. Both tucks are a
 * --tuck variable rather than padding: the column each clears holds the
 * panel's ornament (GatheringsCalendar, AboutSharedLife). A tucked panel is taller than it was, so those two sit up
 * from the top of the frame rather than centred, clear of the lockup; on a
 * short viewport (≤ 820px) the who-we-are and give type steps down a size
 * as well. Give's paragraphs also set narrower on smaller desktops, so the
 * words fit between the hood on the left and the apostle on the right.
 * On a phone every panel spans the frame and the left apostles stay back
 * (layerSplit.ts), so nothing reaches a panel at rest there; the panels
 * only rise from behind the figures on the way in.
 */
const TUCK: Partial<Record<string, string>> = {
  about:
    "lg:self-start lg:mt-[clamp(96px,12vh,140px)] lg:pl-[clamp(18px,2.6vw,32px)] lg:max-[1439px]:[--tuck:clamp(32px,calc(588px_-_22.7vw_+_4.8vh),320px)] min-[1440px]:ml-[clamp(24px,1.9vw,48px)] min-[1440px]:max-[1799px]:[--tuck:clamp(32px,calc(585px_-_20.8vw_+_4.8vh),340px)] min-[1800px]:[--tuck:clamp(32px,calc(505px_-_20.8vw_+_4.8vh),340px)]",
  gatherings:
    "lg:self-start lg:mt-[clamp(96px,12vh,140px)] lg:[--tuck:clamp(120px,calc(58.8vw_-_63.6vh_-_60px),420px)] lg:pb-[clamp(40px,calc(30vh_-_200px),120px)] 2xl:max-w-[1200px]",
  give: "lg:translate-x-[clamp(120px,9.4vw,160px)] lg:px-[clamp(120px,9.4vw,160px)]",
};

/**
 * A scene stop's copy block: a panel of frosted glass, so the words read
 * over the brightest parts of the plate while the engraving still shows
 * through, with the frame's brackets just outside its edges. The whole panel
 * — glass, brackets and words — sits under the front canvas, so the nearest
 * figures cross it: it scrolls in from behind them, and at rest an edge of
 * the glass tucks behind one while the words sit clear (the glass blurs only
 * the back canvas, so a figure over it stays sharp). Nothing inside may
 * carry a step of STACK: the panel is a stacking context of its own.
 */
function Bracketed({
  ref,
  shown,
  className = "",
  onMouseEnter,
  onMouseLeave,
  children,
}: {
  /** the panel, for the stop to watch (Scene) */
  ref: React.RefObject<HTMLDivElement | null>;
  /**
   * whether the panel is shown: its brackets slide home and its words rise,
   * and reset when it is not, so every turn of the page brings them in again
   */
  shown: boolean;
  className?: string;
  /** for a panel lit as a whole while the reader is over it */
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      ref={ref}
      data-copy-panel=""
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`${between} ${GLASS} p-[clamp(18px,2.6vw,32px)] ${GLASS_CORNERS} ${className}`}
    >
      <CornerOrnaments inset={PANEL_BRACKET_OUT} shown={shown} />
      <PanelShownContext.Provider value={shown}>
        {children}
      </PanelShownContext.Provider>
    </div>
  );
}

/** the ornamented rule that opens a long-form section, drawn the first time it is seen */
function SectionRule() {
  const ref = useRef<HTMLSpanElement>(null);
  const drawn = useInViewOnce(ref, RULE_DRAW_THRESHOLD);
  return <OrnateRule ref={ref} drawn={drawn} className={SEPARATOR} />;
}

/** a copy panel's words: they rise in with the panel's brackets and go back out with them */
function PanelReveal(
  props: Omit<React.ComponentProps<typeof Reveal>, "shown">,
) {
  const shown = useContext(PanelShownContext);
  return <Reveal shown={shown} {...props} />;
}

/** the scene frame's corners: the G mark's box, rounded top-left and bottom-right only */
const FRAME_CORNERS =
  "rounded-tl-[clamp(48px,7vw,110px)] rounded-br-[clamp(48px,7vw,110px)]";

function jumpTo(id: string) {
  // through the smoother when one is running, native smooth scroll otherwise
  scrollJumpTo(id, getScrollDriver());
}

function jump(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
  e.preventDefault();
  jumpTo(id);
}

function longform(site: SiteContent, id: string) {
  return site.longform.find((s) => s.id === id)!;
}

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
  const devotions = longform(site, "devotions");
  const beliefs = longform(site, "beliefs");
  const faq = longform(site, "faq");
  const messages = longform(site, "messages");
  const { contact } = site;

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

      {/* the nav outlives the scene: fixed for the whole page, zero height so it
          takes no room. Fixed, and outside the smoother's content — a transformed
          ancestor would turn fixed into absolute. Over the scene the bar itself
          carries no backdrop-filter at all (not even blur(0)): a backdrop-filter
          makes the bar a backdrop root, and the links' frosted glass inside it
          could then blur only the bar's own contents, never the scene */}
      <div
        className={`pointer-events-none fixed inset-x-0 top-0 ${STACK.nav} h-0`}
      >
        <nav
          className={`pointer-events-auto absolute inset-x-[clamp(9px,2.4vw,26px)] top-[clamp(9px,2.4vw,26px)] flex flex-wrap items-center justify-between gap-x-6 gap-y-3.5 rounded-[clamp(16px,2.4vw,26px)] px-[clamp(16px,3.4vw,34px)] py-[clamp(16px,2.6vw,26px)] transition-colors duration-500 ${
            sceneInView ? "" : "bg-ink/90 backdrop-blur-sm"
          }`}
        >
          {/* below xl: the seal mark and a Menu that opens the sheet. Nine links,
              the mark and both buttons need ~1240px for one row, so the full
              desktop nav waits for the xl breakpoint */}
          <MobileNav
            className="xl:hidden"
            activeId={activeId}
            onNavigate={jumpTo}
          />
          {/* from xl up, on the left: the two calls to action, stood in from
              the frame's rounded corner so they do not crowd the curve */}
          <div
            data-nav-actions=""
            className="hidden items-center gap-3 xl:ml-[clamp(24px,3.2vw,56px)] xl:flex"
          >
            <a
              href="#give"
              data-nav-reveal=""
              onClick={(e) => jump(e, "give")}
              className={`${GHOST_BUTTON} px-[22px] py-[11px] text-[11px] uppercase tracking-[0.18em]`}
            >
              Give
            </a>
            <a
              href="#visit"
              data-nav-reveal=""
              onClick={(e) => jump(e, "visit")}
              className={`${SEAL_BUTTON} px-6 py-3 text-[11px] font-bold uppercase tracking-[0.18em]`}
            >
              Join Sunday
            </a>
          </div>
          {/* from xl up, on the right: the section links, then the G mark at the corner */}
          <div className="hidden items-center gap-[clamp(14px,1.8vw,26px)] xl:flex">
            {/* the words alone take the glass; the mark beside them stays bare */}
            <NavLinks
              items={site.nav}
              activeId={activeId}
              onNavigate={jumpTo}
              className={`${GLASS} ${GLASS_CORNERS} px-[clamp(10px,1.2vw,18px)] py-2`}
            />
            <a
              href="#hero"
              data-nav-mark=""
              onClick={(e) => jump(e, "hero")}
              className={`inline-flex rounded-sm text-cream transition-opacity duration-300 hover:opacity-80 ${FOCUS_RING}`}
            >
              <GMark size={40} ruled />
            </a>
          </div>
        </nav>
      </div>

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
            dvh and lvh agree */}
            <div
              ref={frameRef}
              className={`pointer-events-none sticky top-0 ${STACK.copy} col-start-1 row-start-1 h-[100dvh] self-start`}
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
            <section
              id={devotions.id}
              className={`scroll-mt-24 ${gutter} py-[clamp(56px,9vh,140px)] md:py-[clamp(80px,12vh,140px)]`}
            >
              <SectionRule />
              <div className="mx-auto flex max-w-[1080px] flex-col gap-10">
                <Reveal
                  as="header"
                  className="flex max-w-[640px] flex-col gap-5"
                >
                  <p className={kickerCls}>{devotions.kicker}</p>
                  <h2
                    className={`text-[clamp(34px,4.1vw,58px)] leading-[1.06] ${serif}`}
                  >
                    {devotions.heading}
                  </h2>
                  <p className="text-lg leading-relaxed text-pretty text-cream/75">
                    {site.devotionsIntro}
                  </p>
                </Reveal>
                {/* revealed per item, so the list comes in as it is reached however tall it runs */}
                <ol className="grid gap-x-10 gap-y-9 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
                  {site.devotions.map((d, i) => (
                    <Reveal
                      as="li"
                      key={d.title}
                      className="rule-draw flex flex-col gap-3 pt-5"
                    >
                      <p className="text-xs uppercase tracking-[0.16em] text-seal">
                        {String(i + 1).padStart(2, "0")} ·{" "}
                        <ScriptureRefs refs={d.refs} />
                      </p>
                      <h3 className={`text-[28px] leading-[1.12] ${serif}`}>
                        {d.title}
                      </h3>
                      <p className="text-base leading-relaxed text-cream/70">
                        {d.body}
                      </p>
                    </Reveal>
                  ))}
                </ol>
              </div>
            </section>

            <section
              id={beliefs.id}
              className={`scroll-mt-24 ${gutter} py-[clamp(56px,9vh,140px)] md:py-[clamp(80px,12vh,140px)]`}
            >
              <SectionRule />
              <div className="mx-auto flex max-w-[1080px] flex-col gap-12">
                <Reveal
                  as="header"
                  className="flex max-w-[720px] flex-col gap-5"
                >
                  <p className={kickerCls}>{beliefs.kicker}</p>
                  <h2
                    className={`text-[clamp(34px,4.1vw,58px)] leading-[1.06] ${serif}`}
                  >
                    {beliefs.heading}
                  </h2>
                </Reveal>
                <ul className="grid gap-8 md:grid-cols-3">
                  {site.beliefPosture.map((p) => (
                    <Reveal
                      as="li"
                      key={p.ref}
                      className="rule-draw flex flex-col gap-3 pt-5"
                    >
                      <p className={`text-[22px] leading-snug ${serif}`}>
                        {p.line}
                      </p>
                      <p className="text-sm leading-relaxed text-cream/60">
                        “{p.quote}”
                      </p>
                      <p className="text-xs uppercase tracking-[0.16em] text-seal">
                        {p.ref}
                      </p>
                    </Reveal>
                  ))}
                </ul>
                <dl className="grid gap-x-10 gap-y-10 md:grid-cols-2">
                  {site.beliefs.map((b) => (
                    <Reveal key={b.title} className="flex flex-col gap-3">
                      <dt className={`text-[28px] leading-[1.12] ${serif}`}>
                        {b.title}
                      </dt>
                      <dd className="text-base leading-relaxed text-cream/70">
                        {b.body}
                      </dd>
                      <dd className="text-xs uppercase tracking-[0.16em] text-seal">
                        <ScriptureRefs refs={b.refs} />
                      </dd>
                    </Reveal>
                  ))}
                </dl>
              </div>
            </section>

            <section
              id={faq.id}
              className={`scroll-mt-24 ${gutter} py-[clamp(56px,9vh,140px)] md:py-[clamp(80px,12vh,140px)]`}
            >
              <SectionRule />
              <div className="mx-auto flex max-w-[1080px] flex-col gap-10 md:flex-row md:gap-16">
                <Reveal as="header" className="flex flex-col gap-5 md:w-1/3">
                  <p className={kickerCls}>{faq.kicker}</p>
                  <h2
                    className={`text-[clamp(34px,4.1vw,58px)] leading-[1.06] ${serif}`}
                  >
                    {faq.heading}
                  </h2>
                </Reveal>
                <dl className="flex flex-1 flex-col">
                  {site.faq.map((q) => (
                    <Reveal
                      key={q.question}
                      className="rule-draw flex flex-col gap-3 py-6"
                    >
                      <dt className={`text-[26px] leading-[1.15] ${serif}`}>
                        {q.question}
                      </dt>
                      <dd className="text-base leading-relaxed text-cream/70">
                        {q.answer}
                      </dd>
                    </Reveal>
                  ))}
                </dl>
              </div>
            </section>

            <section
              id={messages.id}
              className={`scroll-mt-24 ${gutter} py-[clamp(56px,9vh,140px)] md:py-[clamp(80px,12vh,140px)]`}
            >
              <SectionRule />
              <div className="mx-auto flex max-w-[1080px] flex-col gap-10">
                <Reveal as="header" className="flex flex-col gap-5">
                  <p className={kickerCls}>{messages.kicker}</p>
                  <h2
                    className={`text-[clamp(34px,4.1vw,58px)] leading-[1.06] ${serif}`}
                  >
                    <span className="block text-[11px] uppercase tracking-[0.28em] text-cream/50 font-sans mb-3">
                      Current series
                    </span>
                    {site.messages.series}
                  </h2>
                </Reveal>
                <ol className="grid gap-x-10 gap-y-8 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
                  {site.messages.latest.map((m) => (
                    <Reveal
                      as="li"
                      key={m.href}
                      className="rule-draw flex flex-col gap-3 pt-5"
                    >
                      <p className="text-xs uppercase tracking-[0.16em] text-seal">
                        {m.date} · {m.passage}
                      </p>
                      <h3 className={`text-[26px] leading-[1.15] ${serif}`}>
                        <a
                          href={m.href}
                          className={`${LINK_SWEEP} ${FOCUS_RING} rounded-sm hover:text-cream/80`}
                        >
                          {m.title}
                        </a>
                      </h3>
                      <p className="text-sm text-cream/60">{m.speaker}</p>
                    </Reveal>
                  ))}
                </ol>
                <Reveal className="flex">
                  <p className="text-[11px] uppercase tracking-[0.22em]">
                    <a
                      href={site.messages.all.href}
                      className={`${LINK_SWEEP} ${FOCUS_RING} rounded-sm text-cream/70 hover:text-cream`}
                    >
                      {site.messages.all.label}
                    </a>
                  </p>
                </Reveal>
              </div>
            </section>

            <footer
              className={`${gutter} border-t border-cream/15 py-[clamp(48px,8vh,80px)]`}
            >
              <Reveal
                stagger={REVEAL_STAGGER_MS * 2}
                className="mx-auto grid max-w-[1080px] gap-10 text-sm text-cream/70 md:grid-cols-3"
              >
                <div className="flex flex-col gap-2">
                  <p className={`text-[22px] text-cream ${serif}`}>
                    {site.name}
                  </p>
                  <p>
                    {contact.address.street} {contact.address.suite}
                    <br />
                    {contact.address.city}
                  </p>
                  <p>Sunday Worship Gathering · {contact.sunday}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <a
                    href={`mailto:${contact.email}`}
                    className={`${LINK_SWEEP} ${FOCUS_RING} self-start rounded-sm hover:text-cream`}
                  >
                    {contact.email}
                  </a>
                  <p>{contact.pastor.name}, pastor</p>
                  <a
                    href={`mailto:${contact.pastor.email}`}
                    className={`${LINK_SWEEP} ${FOCUS_RING} self-start rounded-sm hover:text-cream`}
                  >
                    {contact.pastor.email}
                  </a>
                </div>
                <div className="flex flex-col gap-2 md:items-end">
                  <p className="flex flex-wrap gap-x-4 gap-y-2 text-[11px] uppercase tracking-[0.22em]">
                    <span className="text-cream/45">{site.footer.follow}</span>
                    {site.socials.map((s) => (
                      <a
                        key={s.href}
                        href={s.href}
                        className={`${LINK_SWEEP} ${FOCUS_RING} rounded-sm hover:text-cream`}
                      >
                        {s.label}
                      </a>
                    ))}
                  </p>
                  <p className="text-xs text-cream/45">
                    © {site.footer.copyright}
                  </p>
                </div>
              </Reveal>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}

/** how long a kicker's rule takes to draw, in ms, and how long after its panel's brackets start */
const KICKER_RULE_MS = 900;
const KICKER_RULE_AT_MS = 300;

/**
 * A section's kicker with the hairline rule under it, both between the
 * canvases like the rest of a section's words. The rule draws out — from
 * the left, or from the middle when centred — when the panel around it is
 * shown, or as `drawn` says.
 */
function Kicker({
  children,
  className = "",
  centred = false,
  drawn,
}: {
  children: React.ReactNode;
  className?: string;
  centred?: boolean;
  /** when to draw the rule; by default, with the panel's brackets */
  drawn?: boolean;
}) {
  const shown = useContext(PanelShownContext);
  const on = drawn ?? shown;
  return (
    <div
      className={`flex flex-col gap-3 ${centred ? "items-center" : ""} ${className}`}
    >
      <p className={`${between} text-balance ${kickerCls}`}>{children}</p>
      <hr
        aria-hidden
        data-kicker-rule=""
        data-drawn={on ? "true" : "false"}
        className={`${between} h-px w-12 border-0 bg-cream/30 motion-safe:transition-transform motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)] ${centred ? "origin-center" : "origin-left"} ${on ? "" : "motion-safe:scale-x-0"}`}
        style={{
          transitionDuration: `${KICKER_RULE_MS}ms`,
          transitionDelay: `${KICKER_RULE_AT_MS}ms`,
        }}
      />
    </div>
  );
}

/**
 * The gatherings' ornament: a month of Sundays in the G mark's box, on the
 * left of the panel in the column its tuck clears for the figures, cascading
 * in with the panel's brackets and lit for the gathering under the pointer
 * (GatheringCalendar). A divider stands between it and the words. The
 * column exists only where the panel tucks; below lg the month lies across
 * under the headline instead (`across`), lit for whichever gathering's
 * emblem (GatheringEmblem) lit last as they light in turn (Scene).
 */
/**
 * A gathering's emblem at the foot of its column (GatheringMark): its
 * lozenges trace in with the panel's brackets, and gather while the reader
 * is over the gathering.
 */
function GatheringEmblem({ mark, lit }: { mark: Mark; lit: boolean }) {
  const shown = useContext(PanelShownContext);
  return (
    <GatheringMark
      mark={mark}
      shown={shown}
      lit={lit}
      className="mx-auto mt-2 h-7 w-7 text-seal md:mt-auto md:h-11 md:w-11 md:pt-2 [@media(max-height:820px)]:lg:h-9 [@media(max-height:820px)]:lg:w-9"
    />
  );
}

function GatheringsCalendar({
  lit,
  across = false,
}: {
  lit: Mark | null;
  across?: boolean;
}) {
  const shown = useContext(PanelShownContext);
  if (across) {
    return (
      <div data-gatherings-calendar="" className="my-1 lg:hidden">
        <GatheringCalendar
          lit={lit}
          shown={shown}
          across
          className="w-full max-w-[320px]"
        />
      </div>
    );
  }
  return (
    <div
      data-gatherings-calendar=""
      // its width is the tuck less the panel's padding (Bracketed), so the
      // words start where the tuck put them; Tailwind reads classes literally.
      // The month is absolutely placed inside, so it fills the column's height
      // (set by the words beside it) without ever adding to it
      className="relative hidden shrink-0 border-r border-cream/25 pr-[clamp(20px,2vw,32px)] lg:block lg:w-[calc(var(--tuck)_-_clamp(18px,2.6vw,32px))]"
    >
      <GatheringCalendar
        lit={lit}
        shown={shown}
        className="absolute inset-y-1 left-0 h-[calc(100%_-_8px)] w-[calc(100%_-_clamp(20px,2vw,32px))]"
      />
    </div>
  );
}

/**
 * The visit stop's way in (WayIn): five steps from a first hello to a house
 * church of one's own, drawn in with the panel's brackets; the reader walks
 * them by the diamond arrows. Below lg (`single`) the current step stands
 * alone between the arrows, and the next slides in when one is pressed.
 */
function TheWayIn({
  step,
  onStep,
  single,
}: {
  step: number;
  onStep: (step: number) => void;
  single: boolean;
}) {
  const site = useSite();
  const shown = useContext(PanelShownContext);
  return (
    <WayIn
      steps={wayIn(site)}
      step={step}
      onStep={onStep}
      shown={shown}
      single={single}
      className="pt-1"
    />
  );
}

/**
 * Where a stop's column ornament sits (HouseChurchesTable, AboutSharedLife):
 * from md up in a column on the right of the words past a divider, the
 * drawing absolutely placed inside so it fills the column's height (set by
 * the words beside it) without ever adding to it; on a phone, where the
 * words need the whole width, under them at the panel's left, its own
 * height. The desktop column's width is each ornament's own.
 */
const ORNAMENT_COLUMN =
  "relative mt-5 shrink-0 md:mt-0 md:w-[clamp(72px,20vw,120px)] md:border-l md:border-cream/25 md:pl-[clamp(20px,2vw,32px)]";
const ORNAMENT_IN_COLUMN =
  "w-[clamp(72px,20vw,120px)] md:absolute md:inset-y-1 md:right-0 md:h-[calc(100%_-_8px)] md:w-[calc(100%_-_clamp(20px,2vw,32px))]";

/**
 * The house churches' ornament, the calendar's mirror: a house church at
 * table in the G mark's box (HouseTable), on the right of the panel past a
 * divider, its seats taken with the panel's brackets and drawn in while
 * the reader is over the panel — or, below lg, while the stop is settled
 * on screen (Scene), seated under the words on a phone (ORNAMENT_COLUMN).
 */
function HouseChurchesTable({ lit }: { lit: boolean }) {
  const shown = useContext(PanelShownContext);
  return (
    <div
      data-house-churches-table=""
      className={`${ORNAMENT_COLUMN} lg:w-[clamp(150px,12vw,200px)]`}
    >
      {/* a phone lays the table on its side under the words (the column is
          too tall a drawing there); from md it stands in its column */}
      <HouseTable
        lit={lit}
        shown={shown}
        across
        className="w-full max-w-[300px] md:hidden"
      />
      <HouseTable
        lit={lit}
        shown={shown}
        className={`hidden md:block ${ORNAMENT_IN_COLUMN}`}
      />
    </div>
  );
}

/**
 * The giving's ornament: a field sown and reaped in the G mark's box
 * (SowingMark), standing in the band the give panel pads on its left to keep
 * its words centred under the hood (TUCK). It cascades in with the panel's
 * brackets and the harvest fills while the reader is over the panel. Below
 * lg there is no band: the field stands at the head of the panel over the
 * words, a size that keeps its tiles the calendar's, and fills while the
 * stop is settled on screen (Scene).
 */
function GiveSowing({ lit }: { lit: boolean }) {
  const shown = useContext(PanelShownContext);
  return (
    <div
      data-give-sowing=""
      // on desktop it starts at the glass's padding and runs the width of
      // the house table's column (HouseChurchesTable), wider than the give
      // tuck alone: the words set narrower than the room the tuck leaves
      // them, so the field can borrow the slack and keep tiles the
      // calendar's size
      className="relative w-[clamp(120px,32vw,150px)] lg:absolute lg:top-1/2 lg:left-[clamp(18px,2.6vw,32px)] lg:w-[clamp(140px,11.5vw,200px)] lg:-translate-y-1/2"
    >
      <SowingMark lit={lit} shown={shown} className="w-full" />
    </div>
  );
}

/**
 * The who-we-are's ornament: an order of service that huddles into a life
 * shared (SharedLife), on the right of the panel past a divider, in the
 * column its tuck clears for the two near apostles — never narrower than
 * the house table's column, so on a wide screen where the tuck is slight
 * the words give up the room instead. Its rows print in with the panel's
 * brackets and huddle while the reader is over the panel — or, below lg,
 * while the stop is settled on screen (Scene), seated under the words on
 * a phone (ORNAMENT_COLUMN).
 */
function AboutSharedLife({ lit }: { lit: boolean }) {
  const shown = useContext(PanelShownContext);
  return (
    <div
      data-about-shared-life=""
      className={`${ORNAMENT_COLUMN} lg:w-[max(clamp(120px,9vw,160px),calc(var(--tuck)_-_clamp(18px,2.6vw,32px)))]`}
    >
      {/* a phone runs the dozen rows six and six, side by side (a single
          column runs too long under the words); from md the tall column */}
      <SharedLife
        lit={lit}
        shown={shown}
        columns={2}
        className="w-full max-w-[300px] md:hidden"
      />
      <SharedLife
        lit={lit}
        shown={shown}
        className={`hidden md:block ${ORNAMENT_IN_COLUMN}`}
      />
    </div>
  );
}

/**
 * The hero's lockup, rendered once: from lg up pinned in the sticky chrome's
 * bottom-left corner over every stop; below lg at the hero's foot, where it
 * stacks (Lockup.tsx) and scrolls away with the hero — from the second stop
 * on the G in the nav corner carries the identity (#53). Above the front
 * canvas either way, so the nearest figures never cover it.
 */
function HeroLockup({ at }: { at: "chrome" | "foot" }) {
  const belowLg = useBelowLg();
  if (belowLg !== (at === "foot")) return null;
  return (
    <div
      data-hero-lockup=""
      className={
        at === "chrome"
          ? "absolute bottom-[clamp(22px,4.2vw,52px)] left-[clamp(20px,4.4vw,60px)] right-[clamp(20px,4.4vw,60px)] flex justify-start"
          : `relative ${STACK.copy} mt-auto flex justify-start`
      }
    >
      {/* the seal is live so the stamp can replay on click, resting with its filters off */}
      <Lockup sealVariant="live" interactiveSeal />
    </div>
  );
}

/** one viewport of the scene; the layout varies by stop, the words come from site.ts */
function Scene({ section: s }: { section: SceneSection }) {
  const site = useSite();
  const pending = useContext(IntroPendingContext);
  // the gathering under the pointer, lighting the tiles beside the headline
  const [lit, setLit] = useState<Mark | null>(null);
  // whether the reader is over the house churches' panel, seating its table,
  // or the who-we-are's, huddling its program
  const [over, setOver] = useState(false);
  // whether the pointer is over the giving, filling the field beside its words
  const [giving, setGiving] = useState(false);
  // the step of the way in the reader stands on (visit)
  const [way, setWay] = useState(0);
  // the stop's panel, watched for when it is shown (PANEL_SHOWN_*). Below lg
  // the same signal plays the stop's ornament — the pointer's part on
  // desktop — while the panel is settled on screen, and undoes it as the
  // panel leaves; under reduced motion the panel is shown and the ornament
  // rests. The hero has no panel: its watch reports the initial answer
  const belowLg = useBelowLg();
  const reduced = useContext(ReducedMotionContext);
  const panelRef = useRef<HTMLDivElement>(null);
  const settled = useInView(
    panelRef,
    belowLg ? PANEL_SHOWN_BELOW_LG : PANEL_SHOWN_DESKTOP,
  );
  const shown = belowLg ? reduced || settled : settled;
  const settledIn = belowLg && !reduced && settled;
  // the stop's ornament lights a beat after it is in, and the gathering
  // emblems in turn; the calendar beside them is desktop's, lit by the pointer
  const playing = useInTurn(settledIn, 1, 0, ORNAMENT_LIT_AT_MS) > 0;
  const inTurn = useInTurn(
    settledIn,
    site.gatherings.length,
    EMBLEM_LIT_STEP_MS,
    ORNAMENT_LIT_AT_MS,
  );
  const panel = { ref: panelRef, shown };
  // no z-index: a section must not form a stacking context, or its headline
  // could never sit under the front canvas while its copy sits over it.
  // On desktop a section is one viewport: one camera waypoint each, turned
  // like pages. Below lg the scene scrolls natively (#52) and a section is as
  // tall as its words; only the hero keeps the whole first frame, so the
  // lockup at its foot stands alone before the next section's words arrive
  // the hero and the visit stop keep a full viewport at every width: the first
  // frame must not show the next stop, and the scene's sticky canvas leaves with
  // the last section, so a short last section would take the dove away before
  // the reader reached it
  // a held section is lvh, the tallest the viewport ever gets on a phone: at
  // svh the next stop's card sits inside the first frame the moment the URL
  // bar retracts. The unheld sections keep svh — that is only a floor on a
  // desktop viewport, where the three are the same number
  const holds = s.id === "hero" || s.id === "visit";
  const base = `relative flex ${holds ? "min-h-[100lvh]" : "lg:min-h-[100svh]"} ${gutter} max-lg:px-8`;
  // below lg the seal row sits over the top of every section and the lockup
  // over its foot; desktop keeps its unpadded frames
  const clear = "pt-[clamp(88px,11vh,110px)] pb-[clamp(72px,9vh,96px)] lg:py-0";
  if (s.id === "hero") {
    return (
      <section
        id={s.id}
        data-screen-label={s.label}
        // below lg the lockup is the hero's last child, set into the same
        // corner the chrome pins it to on desktop; lg and up the padding
        // clears the pinned one
        className={`${base} flex-col pt-[clamp(112px,17vh,180px)] pb-[clamp(22px,4.2vw,52px)] lg:pb-[clamp(150px,24vh,220px)]`}
      >
        <Kicker className="mb-[22px]" drawn={!pending}>
          {s.kicker}
        </Kicker>
        {/* the one headline the nearest figures may clip at its edges; it
            rises line by line once the splash has handed off (heroRise.ts) */}
        <h1
          data-hero-headline=""
          className={`${between} max-w-[15ch] text-[clamp(42px,9vw,72px)] leading-[1.02] tracking-[-0.005em] text-pretty lg:text-[clamp(42px,5.6vw,84px)] ${serif}`}
        >
          {s.heading}
        </h1>
        <HeroLockup at="foot" />
      </section>
    );
  }
  if (s.id === "gatherings") {
    // each gathering's mark; a gathering published before the marks existed
    // takes one by position. Below lg the emblems light in turn, and the
    // month across lights for the one that lit last
    const marks = site.gatherings.map(
      (g, i) => g.mark ?? GATHERING_MARKS[i % GATHERING_MARKS.length],
    );
    const litInTurn = inTurn > 0 ? (marks[inTurn - 1] ?? null) : null;
    return (
      <section
        id={s.id}
        data-screen-label={s.label}
        className={`${base} ${clear} items-center`}
      >
        {/* three cards stack on a phone, so they tighten up to fit one viewport */}
        <Bracketed
          {...panel}
          className={`flex w-full max-w-[1080px] flex-col lg:flex-row ${TUCK[s.id]}`}
        >
          <GatheringsCalendar lit={lit} />
          <div className="flex min-w-0 flex-1 flex-col gap-6 md:gap-11 lg:pl-[clamp(24px,2.4vw,40px)] [@media(max-height:820px)]:lg:gap-7">
            <PanelReveal className="flex flex-col gap-3 md:gap-4">
              <Kicker>{s.kicker}</Kicker>
              <h2
                className={`text-[clamp(30px,3.4vw,48px)] leading-[1.06] text-balance [@media(max-height:820px)]:lg:text-[36px] ${serif}`}
              >
                {s.heading}
              </h2>
            </PanelReveal>
            {/* below lg the month lies across under the headline, where the
              desktop's column would have no room */}
            <GatheringsCalendar across lit={belowLg ? litInTurn : lit} />
            {/* two gatherings side by side, each closed by its lozenge mark,
              centred under the words and pushed to the card's foot so the two
              marks sit level across the columns. The whole block steps
              down a size on a short desktop viewport (see TUCK) */}
            <PanelReveal
              delay={REVEAL_STAGGER_MS * 2}
              className="grid gap-5 md:grid-cols-2 md:gap-x-12 md:gap-y-8"
            >
              {site.gatherings.map((g, i) => {
                const mark = marks[i];
                return (
                  <div
                    key={g.title}
                    data-gathering={mark}
                    onMouseEnter={() => setLit(mark)}
                    onMouseLeave={() =>
                      setLit((was) => (was === mark ? null : was))
                    }
                    className="rule-draw flex flex-col gap-2 pt-4 md:gap-4 md:pt-7 [@media(max-height:820px)]:lg:gap-3 [@media(max-height:820px)]:lg:pt-5"
                  >
                    <h3
                      className={`text-[24px] leading-[1.12] md:text-[34px] [@media(max-height:820px)]:lg:text-[27px] ${serif}`}
                    >
                      {g.title}
                    </h3>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-seal md:text-xs">
                      {g.when}
                    </p>
                    <p className={`text-[15px] leading-[1.5] text-pretty text-cream/75 md:text-lg md:leading-relaxed [@media(max-height:820px)]:lg:text-base ${PHONE_BODY}`}>
                      {g.body}
                    </p>
                    <GatheringEmblem
                      mark={mark}
                      lit={belowLg ? i < inTurn : lit === mark}
                    />
                  </div>
                );
              })}
            </PanelReveal>
          </div>
        </Bracketed>
      </section>
    );
  }
  if (s.id === "visit") {
    const steps = wayIn(site);
    const at = steps[Math.min(way, steps.length - 1)];
    // the dove hangs in the upper third of the visit frame; the panel sits
    // under it, and fills the frame's width up to a reading measure. Its
    // headline and body are the current step's, and rise in each time the
    // traveller lands; the way in itself stands at the panel's foot
    return (
      <section
        id={s.id}
        data-screen-label={s.label}
        className={`${base} ${clear} flex-col items-center justify-end text-center lg:pt-[clamp(104px,13vh,140px)] lg:pb-[clamp(120px,17vh,170px)]`}
      >
        {/* the panel keeps clear of the lockup at the frame's foot, so it sets
            a size down from the give stop's and tighter still on a short viewport */}
        <Bracketed
          {...panel}
          className="flex w-full max-w-[820px] flex-col items-center gap-5 [@media(max-height:820px)]:lg:gap-3"
        >
          {/* the kicker stands at the panel's left, its rule drawn from there; the rest is centred */}
          <Kicker className="self-start text-left">{s.kicker}</Kicker>
          <PanelReveal className="flex w-full flex-col items-center gap-5 [@media(max-height:820px)]:lg:gap-3">
            {/* the words' height eases from one step to the next, so the glass
                grows and shrinks with them instead of jumping */}
            {/* wrapped, so the reveal's own transition stays on the wrapper
                and the height's on the block (Reveal) */}
            <div className="w-full">
              <SmoothHeight className="w-full">
                <div
                  key={way}
                  data-way-words=""
                  aria-live="polite"
                  className="way-in-rise flex flex-col items-center gap-5 [@media(max-height:820px)]:lg:gap-3"
                >
                  <h2
                    className={`max-w-[20ch] text-[clamp(36px,4.2vw,56px)] leading-[1.04] text-balance [@media(max-height:820px)]:lg:text-[42px] ${serif}`}
                  >
                    {at?.title}
                  </h2>
                  <p className={`max-w-[52ch] text-base leading-relaxed text-pretty text-cream/80 md:text-lg [@media(max-height:820px)]:lg:text-base ${PHONE_BODY}`}>
                    {at?.body}
                  </p>
                  {/* the call to write sits under the first step's words, and goes with them */}
                  {way === 0 && s.cta && (
                    <a
                      href={s.cta.href}
                      className={`${SEAL_BUTTON} px-[34px] py-4 text-xs font-bold uppercase tracking-[0.2em]`}
                    >
                      {s.cta.label}
                    </a>
                  )}
                </div>
              </SmoothHeight>
            </div>
            <TheWayIn step={way} onStep={setWay} single={belowLg} />
          </PanelReveal>
        </Bracketed>
      </section>
    );
  }
  if (s.id === "give") {
    return (
      <section
        id={s.id}
        data-screen-label={s.label}
        className={`${base} flex-col items-center text-center justify-center ${clear} lg:pt-[clamp(100px,13vh,130px)] lg:pb-[clamp(150px,20vh,190px)]`}
      >
        <Bracketed
          {...panel}
          className={`flex flex-col items-center gap-5 md:gap-[26px] ${TUCK[s.id] ?? ""}`}
          onMouseEnter={s.id === "give" ? () => setGiving(true) : undefined}
          onMouseLeave={s.id === "give" ? () => setGiving(false) : undefined}
        >
          {s.id === "give" && (
            <GiveSowing lit={belowLg ? playing : giving} />
          )}
          <Kicker centred>{s.kicker}</Kicker>
          <PanelReveal className="flex flex-col items-center gap-5 md:gap-[26px]">
            <h2
              className={`max-w-[20ch] text-[clamp(40px,5.2vw,76px)] leading-[1.04] text-balance [@media(max-height:820px)]:lg:text-[56px] ${serif}`}
            >
              {s.heading}
            </h2>
            {s.body.map((p) => (
              <p
                key={p}
                className={`max-w-[52ch] text-base leading-relaxed text-pretty text-cream/80 md:text-lg lg:max-w-[38ch] min-[1440px]:max-w-[40ch] 2xl:max-w-[44ch] [@media(max-height:820px)]:lg:text-base ${PHONE_BODY}`}
              >
                {p}
              </p>
            ))}
            {s.cta && (
              <a
                href={s.cta.href}
                className={`${SEAL_BUTTON} px-[34px] py-4 text-xs font-bold uppercase tracking-[0.2em]`}
              >
                {s.cta.label}
              </a>
            )}
          </PanelReveal>
        </Bracketed>
      </section>
    );
  }
  // about and house churches: a single column, left or right of the crowd
  // house churches sits to the right of the crowd, but well in from the
  // frame's edge, nearer the middle than the about stop's left-hand column;
  // no near figure reaches it at rest — it only rises from behind them
  const side =
    s.id === "house-churches"
      ? "justify-end lg:pr-[clamp(48px,11vw,200px)]"
      : "";
  // the who-we-are column gives up its right third to the two near apostles
  // (TUCK), so its words set a size smaller to keep the panel one screen tall
  const about = s.id === "about";
  // house churches seats its table in a column on the right of the words,
  // the calendar's mirror, so its panel runs wider than a column alone
  const houses = s.id === "house-churches";
  // both seat an ornament in a column beside the words, lit while the reader is over the panel
  const beside = about || houses;
  const words = (
    <>
      <Kicker>{s.kicker}</Kicker>
      <PanelReveal className="flex flex-col gap-5 md:gap-[26px]">
        <h2
          className={`${about ? "text-[clamp(30px,2.8vw,48px)] [@media(max-height:820px)]:lg:text-[36px]" : "text-[clamp(34px,4.1vw,58px)]"} leading-[1.06] text-balance ${serif}`}
        >
          {s.heading}
        </h2>
        {s.body.map((p) => (
          <p
            key={p}
            className={`text-base leading-relaxed text-pretty text-cream/80 ${about ? "[@media(max-height:820px)]:lg:text-[14px]" : "md:text-lg"} ${PHONE_BODY}`}
          >
            {p}
          </p>
        ))}
      </PanelReveal>
    </>
  );
  const column = "flex flex-col gap-5 md:gap-[26px]";
  return (
    <section
      id={s.id}
      data-screen-label={s.label}
      className={`${base} ${clear} items-center ${side}`}
    >
      <Bracketed
        {...panel}
        className={
          beside
            ? `flex w-full max-w-[600px] flex-col ${houses ? "lg:max-w-[840px]" : ""} md:flex-row ${TUCK[s.id] ?? ""}`
            : `${column} max-w-[600px] ${TUCK[s.id] ?? ""}`
        }
        onMouseEnter={beside ? () => setOver(true) : undefined}
        onMouseLeave={beside ? () => setOver(false) : undefined}
      >
        {beside ? (
          <>
            <div
              className={`${column} min-w-0 flex-1 md:pr-[clamp(24px,2.4vw,40px)]`}
            >
              {words}
            </div>
            {houses ? (
              <HouseChurchesTable lit={belowLg ? playing : over} />
            ) : (
              <AboutSharedLife lit={belowLg ? playing : over} />
            )}
          </>
        ) : (
          words
        )}
      </Bracketed>
    </section>
  );
}
