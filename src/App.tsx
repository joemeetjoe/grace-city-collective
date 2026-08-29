import { useEffect, useMemo, useRef, useState } from "react";

import CornerOrnaments, {
  FRAME_ARM,
  FRAME_INSET,
} from "@/components/CornerOrnaments";
import DotRail from "@/components/DotRail";
import GatheringMark from "@/components/GatheringMark";
import { BUTTON_CORNERS, GLASS, GLASS_CORNERS } from "@/components/glass";
import GMark from "@/components/GMark";
import { STACK } from "@/components/layerSplit";
import Lockup from "@/components/Lockup";
import MobileNav from "@/components/MobileNav";
import NavLinks from "@/components/NavLinks";
import OrnateRule from "@/components/OrnateRule";
import ScriptureRefs from "@/components/ScriptureRefs";
import PentecostParallax from "@/components/PentecostParallax";
import StaticPoster from "@/components/StaticPoster";
import { vignetteCss } from "@/components/vignette";
import {
  GATHERING_MARKS,
  type SceneSection,
  sectionIds,
  type SiteContent,
} from "@/content/site";
import { useSite } from "@/content/useSite";
import IntroSplash from "@/intro/IntroSplash";
import { readPolicyInputs, shouldPlayIntro } from "@/intro/introPolicy";
import { fadeParallaxFromInk } from "@/intro/restingFade";
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
 * Where each stop's panel tucks behind the nearest figures (the front cuts
 * of layerSplit.ts): extra padding on that side, so the glass runs on under
 * the figure while the words stop short of it. Who crosses what, at rest:
 * who we are — the panel steps in from the gutter and the two near apostles
 * on the left stand over its right third; house churches — the right-hand apostle's head over the
 * bottom edge; gatherings — the two left apostles' heads over the lower-left
 * corner, the right-hand one over the lower-right; give — a hood over the
 * left edge, so the panel steps right and pads both sides to keep its words
 * centred. Where a figure lands depends on both viewport axes — the
 * waypoints (PentecostParallax) fill the frame's height, and the lateral
 * budget clamps the frame's centre by its aspect — so the who-we-are and
 * gatherings tucks are linear fits in vw and vh to the figures' screen
 * positions measured at six sizes from 1280×720 to 2560×1440 (residuals
 * under 20px); who-we-are steps in from the gutter from 1440 up, and its
 * tuck is set per width range — the ranges are mutually exclusive because
 * Tailwind orders an arbitrary min-[] variant before lg, so a plain
 * min-[1440px]:pr would lose to lg:pr. A tucked panel is taller than it was, so those two sit up
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
    "lg:self-start lg:mt-[clamp(96px,12vh,140px)] lg:pl-[clamp(18px,2.6vw,32px)] lg:max-[1439px]:pr-[clamp(32px,calc(588px_-_22.7vw_+_4.8vh),320px)] min-[1440px]:ml-[clamp(24px,1.9vw,48px)] min-[1440px]:max-[1799px]:pr-[clamp(32px,calc(585px_-_20.8vw_+_4.8vh),340px)] min-[1800px]:pr-[clamp(32px,calc(505px_-_20.8vw_+_4.8vh),340px)]",
  gatherings:
    "lg:self-start lg:mt-[clamp(96px,12vh,140px)] lg:pl-[clamp(120px,calc(58.8vw_-_63.6vh_-_60px),420px)] lg:pb-[clamp(40px,calc(30vh_-_200px),120px)] 2xl:max-w-[1200px]",
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
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  // the brackets slide home once most of the panel is on screen, and reset
  // when it leaves, so every turn of the page brings them in again
  const ref = useRef<HTMLDivElement>(null);
  const shown = useInView(ref, PANEL_ENTER_THRESHOLD);
  return (
    <div
      ref={ref}
      data-copy-panel=""
      className={`${between} ${GLASS} p-[clamp(18px,2.6vw,32px)] ${GLASS_CORNERS} ${className}`}
    >
      <CornerOrnaments inset={PANEL_BRACKET_OUT} shown={shown} />
      {children}
    </div>
  );
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

/** whether an element is on screen; true wherever IntersectionObserver is missing */
function useInView(ref: React.RefObject<HTMLElement | null>, threshold = 0) {
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, threshold]);
  return inView;
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
  const sceneInView = useInView(sceneRef);

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
    <div className="relative bg-ink font-sans text-cream">
      {intro && (
        <IntroSplash
          ready={ready}
          progress={progress}
          onDone={() => setIntro(false)}
        />
      )}

      {/* the nav outlives the scene: fixed for the whole page, zero height so it
          takes no room. Fixed, and outside the smoother's content — a transformed
          ancestor would turn fixed into absolute */}
      <div
        className={`pointer-events-none fixed inset-x-0 top-0 ${STACK.nav} h-0`}
      >
        <nav
          className={`pointer-events-auto absolute inset-x-[clamp(12px,2.4vw,26px)] top-[clamp(12px,2.4vw,26px)] flex flex-wrap items-center justify-between gap-x-6 gap-y-3.5 rounded-[clamp(16px,2.4vw,26px)] px-[clamp(16px,3.4vw,34px)] py-[clamp(16px,2.6vw,26px)] transition-colors duration-500 ${
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
          <div className="hidden items-center gap-3 xl:ml-[clamp(24px,3.2vw,56px)] xl:flex">
            <a
              href="#give"
              onClick={(e) => jump(e, "give")}
              className={`${BUTTON_CORNERS} border border-cream/45 px-[22px] py-[11px] text-[11px] uppercase tracking-[0.18em] transition-colors hover:border-cream hover:bg-cream/10`}
            >
              Give
            </a>
            <a
              href="#visit"
              onClick={(e) => jump(e, "visit")}
              className={`${BUTTON_CORNERS} bg-seal px-6 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-cream transition-colors hover:bg-seal-deep`}
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
              className="inline-flex rounded-sm text-cream transition-opacity hover:opacity-80"
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
          {/* the scene: a sticky canvas under six one-viewport sections, stacked
          in one grid cell so the wrapper is exactly as tall as the sections.
          A sticky child can never leave its container, so the canvas and the
          chrome scroll away with the last section like a final panel, and
          the long-form follows on plain ink. (No negative margins here: a
          sticky element's margin box is what gets constrained, so -mb-[100svh]
          would let it linger one viewport into the long-form.) While the
          smoother transforms the content the sticky is inert and
          useSmoothScroll holds the sticky layers with a scrubbed translate.
          A held layer is transformed, so it is a stacking context of its
          own: each carries one step of STACK (layerSplit.ts). */}
          <div ref={sceneRef} data-scene="" className="relative grid">
            {/* sticky, not fixed: it stays put while the sections scroll over it */}
            <div
              ref={parallaxRef}
              data-parallax=""
              className={`sticky top-0 ${STACK.back} col-start-1 row-start-1 h-[100svh] self-start overflow-hidden`}
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
                className={`pointer-events-none sticky top-0 ${STACK.front} col-start-1 row-start-1 h-[100svh] self-start overflow-hidden`}
              >
                <canvas
                  ref={frontCanvasRef}
                  aria-hidden
                  className="absolute inset-0 block h-full w-full"
                />
              </div>
            )}

            {/* stationary chrome above the front canvas: the lockup in the
            bottom-left corner, and the frame border in the G mark's shape —
            rounded top-left and bottom-right, square elsewhere */}
            <div
              ref={frameRef}
              className={`pointer-events-none sticky top-0 ${STACK.copy} col-start-1 row-start-1 h-[100svh] self-start`}
            >
              <div
                data-hero-lockup=""
                className="absolute bottom-[clamp(22px,4.2vw,52px)] left-[clamp(20px,4.4vw,60px)] right-[clamp(20px,4.4vw,60px)] flex justify-start"
              >
                {/* the seal is live so the stamp can replay on click, resting with its filters off */}
                <Lockup sealVariant="live" interactiveSeal />
              </div>
              <div
                aria-hidden
                data-scene-frame=""
                className={`absolute inset-[clamp(12px,2.4vw,26px)] border border-cream/35 ${FRAME_CORNERS}`}
              />
              {/* not on a phone, where the lockup sits right in the bottom-left corner */}
              <CornerOrnaments
                arm={FRAME_ARM}
                inset={FRAME_INSET}
                className="hidden md:block"
              />
            </div>

            {/* every scene section is exactly one viewport tall — one camera waypoint each */}
            <div className="relative col-start-1 row-start-1">
              {site.scene.map((s) => (
                <Scene key={s.id} section={s} />
              ))}
            </div>
          </div>

          {/* long-form: ordinary scrolling on ink, no waypoints */}
          <div data-longform="" className="relative z-10 bg-ink">
            <section
              id={devotions.id}
              className={`scroll-mt-24 ${gutter} py-[clamp(80px,12vh,140px)]`}
            >
              <OrnateRule className={SEPARATOR} />
              <div className="mx-auto flex max-w-[1080px] flex-col gap-10">
                <header className="flex max-w-[640px] flex-col gap-5">
                  <p className={kickerCls}>{devotions.kicker}</p>
                  <h2
                    className={`text-[clamp(34px,4.1vw,58px)] leading-[1.06] ${serif}`}
                  >
                    {devotions.heading}
                  </h2>
                  <p className="text-lg leading-relaxed text-pretty text-cream/75">
                    {site.devotionsIntro}
                  </p>
                </header>
                <ol className="grid gap-x-10 gap-y-9 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
                  {site.devotions.map((d, i) => (
                    <li
                      key={d.title}
                      className="flex flex-col gap-3 border-t border-cream/25 pt-5"
                    >
                      <p className="text-xs uppercase tracking-[0.16em] text-seal">
                        {String(i + 1).padStart(2, "0")} · <ScriptureRefs refs={d.refs} />
                      </p>
                      <h3 className={`text-[28px] leading-[1.12] ${serif}`}>
                        {d.title}
                      </h3>
                      <p className="text-base leading-relaxed text-cream/70">
                        {d.body}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
            </section>

            <section
              id={beliefs.id}
              className={`scroll-mt-24 ${gutter} py-[clamp(80px,12vh,140px)]`}
            >
              <OrnateRule className={SEPARATOR} />
              <div className="mx-auto flex max-w-[1080px] flex-col gap-12">
                <header className="flex max-w-[720px] flex-col gap-5">
                  <p className={kickerCls}>{beliefs.kicker}</p>
                  <h2
                    className={`text-[clamp(34px,4.1vw,58px)] leading-[1.06] ${serif}`}
                  >
                    {beliefs.heading}
                  </h2>
                </header>
                <ul className="grid gap-8 md:grid-cols-3">
                  {site.beliefPosture.map((p) => (
                    <li
                      key={p.ref}
                      className="flex flex-col gap-3 border-t border-cream/25 pt-5"
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
                    </li>
                  ))}
                </ul>
                <dl className="grid gap-x-10 gap-y-10 md:grid-cols-2">
                  {site.beliefs.map((b) => (
                    <div key={b.title} className="flex flex-col gap-3">
                      <dt className={`text-[28px] leading-[1.12] ${serif}`}>
                        {b.title}
                      </dt>
                      <dd className="text-base leading-relaxed text-cream/70">
                        {b.body}
                      </dd>
                      <dd className="text-xs uppercase tracking-[0.16em] text-seal">
                        <ScriptureRefs refs={b.refs} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </section>

            <section
              id={faq.id}
              className={`scroll-mt-24 ${gutter} py-[clamp(80px,12vh,140px)]`}
            >
              <OrnateRule className={SEPARATOR} />
              <div className="mx-auto flex max-w-[1080px] flex-col gap-10 md:flex-row md:gap-16">
                <header className="flex flex-col gap-5 md:w-1/3">
                  <p className={kickerCls}>{faq.kicker}</p>
                  <h2
                    className={`text-[clamp(34px,4.1vw,58px)] leading-[1.06] ${serif}`}
                  >
                    {faq.heading}
                  </h2>
                </header>
                <dl className="flex flex-1 flex-col">
                  {site.faq.map((q) => (
                    <div
                      key={q.question}
                      className="flex flex-col gap-3 border-t border-cream/25 py-6"
                    >
                      <dt className={`text-[26px] leading-[1.15] ${serif}`}>
                        {q.question}
                      </dt>
                      <dd className="text-base leading-relaxed text-cream/70">
                        {q.answer}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </section>

            <section
              id={messages.id}
              className={`scroll-mt-24 ${gutter} py-[clamp(80px,12vh,140px)]`}
            >
              <OrnateRule className={SEPARATOR} />
              <div className="mx-auto flex max-w-[1080px] flex-col gap-10">
                <header className="flex flex-col gap-5">
                  <p className={kickerCls}>{messages.kicker}</p>
                  <h2
                    className={`text-[clamp(34px,4.1vw,58px)] leading-[1.06] ${serif}`}
                  >
                    <span className="block text-[11px] uppercase tracking-[0.28em] text-cream/50 font-sans mb-3">
                      Current series
                    </span>
                    {site.messages.series}
                  </h2>
                </header>
                <ol className="grid gap-x-10 gap-y-8 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
                  {site.messages.latest.map((m) => (
                    <li
                      key={m.href}
                      className="flex flex-col gap-3 border-t border-cream/25 pt-5"
                    >
                      <p className="text-xs uppercase tracking-[0.16em] text-seal">
                        {m.date} · {m.passage}
                      </p>
                      <h3 className={`text-[26px] leading-[1.15] ${serif}`}>
                        <a
                          href={m.href}
                          className="transition-colors hover:text-cream/80"
                        >
                          {m.title}
                        </a>
                      </h3>
                      <p className="text-sm text-cream/60">{m.speaker}</p>
                    </li>
                  ))}
                </ol>
                <a
                  href={site.messages.all.href}
                  className="self-start text-[11px] uppercase tracking-[0.22em] text-cream/70 transition-colors hover:text-cream"
                >
                  {site.messages.all.label}
                </a>
              </div>
            </section>

            <footer
              className={`${gutter} border-t border-cream/15 py-[clamp(48px,8vh,80px)]`}
            >
              <div className="mx-auto grid max-w-[1080px] gap-10 text-sm text-cream/70 md:grid-cols-3">
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
                    className="transition-colors hover:text-cream"
                  >
                    {contact.email}
                  </a>
                  <p>{contact.pastor.name}, pastor</p>
                  <a
                    href={`mailto:${contact.pastor.email}`}
                    className="transition-colors hover:text-cream"
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
                        className="transition-colors hover:text-cream"
                      >
                        {s.label}
                      </a>
                    ))}
                  </p>
                  <p className="text-xs text-cream/45">
                    © {site.footer.copyright}
                  </p>
                </div>
              </div>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * A section's kicker with the hairline rule under it, both between the
 * canvases like the rest of a section's words.
 */
function Kicker({
  children,
  className = "",
  centred = false,
}: {
  children: React.ReactNode;
  className?: string;
  centred?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-3 ${centred ? "items-center" : ""} ${className}`}
    >
      <p className={`${between} text-balance ${kickerCls}`}>{children}</p>
      <hr
        aria-hidden
        data-kicker-rule=""
        className={`${between} h-px w-12 border-0 bg-cream/30`}
      />
    </div>
  );
}

/** one viewport of the scene; the layout varies by stop, the words come from site.ts */
function Scene({ section: s }: { section: SceneSection }) {
  const site = useSite();
  // no z-index: a section must not form a stacking context, or its headline
  // could never sit under the front canvas while its copy sits over it
  const base = `relative flex min-h-[100svh] ${gutter}`;
  // below lg the seal row sits over the top of every section and the lockup
  // over its foot; desktop keeps its unpadded frames
  const clear = "pt-[clamp(88px,11vh,110px)] pb-[clamp(72px,9vh,96px)] lg:py-0";
  if (s.id === "hero") {
    return (
      <section
        id={s.id}
        data-screen-label={s.label}
        className={`${base} flex-col pt-[clamp(112px,17vh,180px)] pb-[clamp(150px,24vh,220px)]`}
      >
        <Kicker className="mb-[22px]">{s.kicker}</Kicker>
        {/* the one headline the nearest figures may clip at its edges */}
        <h1
          className={`${between} max-w-[15ch] text-[clamp(42px,9vw,72px)] leading-[1.02] tracking-[-0.005em] text-pretty lg:text-[clamp(42px,5.6vw,84px)] ${serif}`}
        >
          {s.heading}
        </h1>
      </section>
    );
  }
  if (s.id === "gatherings") {
    return (
      <section
        id={s.id}
        data-screen-label={s.label}
        className={`${base} ${clear} items-center`}
      >
        {/* three cards stack on a phone, so they tighten up to fit one viewport */}
        <Bracketed
          className={`flex w-full max-w-[1080px] flex-col gap-6 md:gap-11 [@media(max-height:820px)]:lg:gap-7 ${TUCK[s.id]}`}
        >
          <div className="flex flex-col gap-3 md:gap-4">
            <Kicker>{s.kicker}</Kicker>
            <h2
              className={`text-[clamp(30px,3.4vw,48px)] leading-[1.06] text-balance [@media(max-height:820px)]:lg:text-[36px] ${serif}`}
            >
              {s.heading}
            </h2>
          </div>
          {/* two gatherings side by side, each closed by its lozenge mark,
              centred under the words and pushed to the card's foot so the two
              marks sit level across the columns; a gathering published before
              the marks existed takes one by position. The whole block steps
              down a size on a short desktop viewport (see TUCK) */}
          <div className="grid gap-5 md:grid-cols-2 md:gap-x-12 md:gap-y-8">
            {site.gatherings.map((g, i) => (
              <div
                key={g.title}
                className="flex flex-col gap-2 border-t border-cream/25 pt-4 md:gap-4 md:pt-7 [@media(max-height:820px)]:lg:gap-3 [@media(max-height:820px)]:lg:pt-5"
              >
                <h3
                  className={`text-[24px] leading-[1.12] md:text-[34px] [@media(max-height:820px)]:lg:text-[27px] ${serif}`}
                >
                  {g.title}
                </h3>
                <p className="text-[11px] uppercase tracking-[0.16em] text-seal md:text-xs">
                  {g.when}
                </p>
                <p className="text-[15px] leading-[1.5] text-pretty text-cream/75 md:text-lg md:leading-relaxed [@media(max-height:820px)]:lg:text-base">
                  {g.body}
                </p>
                <GatheringMark
                  mark={g.mark ?? GATHERING_MARKS[i % GATHERING_MARKS.length]}
                  className="mx-auto mt-2 h-7 w-7 text-seal md:mt-auto md:h-11 md:w-11 md:pt-2 [@media(max-height:820px)]:lg:h-9 [@media(max-height:820px)]:lg:w-9"
                />
              </div>
            ))}
          </div>
        </Bracketed>
      </section>
    );
  }
  if (s.id === "give" || s.id === "visit") {
    const { contact } = site;
    // the dove hangs in the upper third of the visit frame; the copy sits under it
    const place =
      s.id === "visit"
        ? "justify-end pb-[clamp(150px,20vh,190px)]"
        : `justify-center ${clear} lg:pt-[clamp(100px,13vh,130px)] lg:pb-[clamp(150px,20vh,190px)]`;
    return (
      <section
        id={s.id}
        data-screen-label={s.label}
        className={`${base} flex-col items-center text-center ${place}`}
      >
        <Bracketed
          className={`flex flex-col items-center gap-5 md:gap-[26px] ${TUCK[s.id] ?? ""}`}
        >
          <Kicker centred>{s.kicker}</Kicker>
          <div className="flex flex-col items-center gap-5 md:gap-[26px]">
            <h2
              className={`max-w-[20ch] text-[clamp(40px,5.2vw,76px)] leading-[1.04] text-balance ${s.id === "give" ? "[@media(max-height:820px)]:lg:text-[56px]" : ""} ${serif}`}
            >
              {s.heading}
            </h2>
            {s.body.map((p) => (
              <p
                key={p}
                className={`${s.id === "give" ? "lg:max-w-[38ch] min-[1440px]:max-w-[40ch] 2xl:max-w-[44ch] [@media(max-height:820px)]:lg:text-base" : ""} max-w-[52ch] text-base leading-relaxed text-pretty text-cream/80 md:text-lg`}
              >
                {p}
              </p>
            ))}
            {s.cta && (
              <a
                href={s.cta.href}
                className={`${BUTTON_CORNERS} bg-seal px-[34px] py-4 text-xs font-bold uppercase tracking-[0.2em] text-cream transition-colors hover:bg-seal-deep`}
              >
                {s.cta.label}
              </a>
            )}
            {s.id === "visit" && (
              <p className="mt-3.5 text-[10px] uppercase tracking-[0.24em] text-cream/50">
                {contact.address.street} {contact.address.suite} ·{" "}
                {contact.address.city}
              </p>
            )}
          </div>
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
  return (
    <section
      id={s.id}
      data-screen-label={s.label}
      className={`${base} ${clear} items-center ${side}`}
    >
      <Bracketed
        className={`flex max-w-[600px] flex-col gap-5 md:gap-[26px] ${TUCK[s.id] ?? ""}`}
      >
        <Kicker>{s.kicker}</Kicker>
        <div className="flex flex-col gap-5 md:gap-[26px]">
          <h2
            className={`${about ? "text-[clamp(30px,2.8vw,48px)] [@media(max-height:820px)]:lg:text-[36px]" : "text-[clamp(34px,4.1vw,58px)]"} leading-[1.06] text-balance ${serif}`}
          >
            {s.heading}
          </h2>
          {s.body.map((p) => (
            <p
              key={p}
              className={`text-base leading-relaxed text-pretty text-cream/80 ${about ? "[@media(max-height:820px)]:lg:text-[14px]" : "md:text-lg"}`}
            >
              {p}
            </p>
          ))}
        </div>
      </Bracketed>
    </section>
  );
}
