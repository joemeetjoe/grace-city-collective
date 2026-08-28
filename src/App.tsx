import { useEffect, useMemo, useRef, useState } from "react";

import DotRail from "@/components/DotRail";
import { STACK } from "@/components/layerSplit";
import Lockup from "@/components/Lockup";
import MobileNav from "@/components/MobileNav";
import NavLinks from "@/components/NavLinks";
import PentecostParallax from "@/components/PentecostParallax";
import StaticPoster from "@/components/StaticPoster";
import { vignetteCss } from "@/components/vignette";
import { type SceneSection, sectionIds, type SiteContent } from "@/content/site";
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
// section copy stacks above the front canvas (layerSplit.ts); only the hero
// headline and the kicker rules sit under it, where the nearest layers cross
const above = `relative ${STACK.copy}`;

function jumpTo(id: string) {
  // through the smoother when one is running, native smooth scroll otherwise
  scrollJumpTo(id, getScrollDriver());
}

function jump(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
  e.preventDefault();
  jumpTo(id);
}

/** whether an element is on screen; true wherever IntersectionObserver is missing */
function useInView(ref: React.RefObject<HTMLElement | null>) {
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
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
    shouldUseStaticFallback({ webgl: detectWebgl(), reducedMotion: policy.reducedMotion, saveData: readSaveData() }),
  );
  const [tier] = useState(() => tierFor(readTierInputs()));
  const [ready, setReady] = useState(false);
  const parallaxRef = useRef<HTMLDivElement>(null);
  const chromeRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);
  const frontCanvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  // the smoother's sticky stand-ins — every sticky layer of the scene, so the
  // front canvas and the frame ride with the back canvas; a stable list so
  // the hook runs once
  const [held] = useState(() => [parallaxRef, chromeRef, frontRef, frameRef]);
  useSmoothScroll({ wrapper: wrapperRef, content: contentRef, scene: sceneRef, held }, policy.reducedMotion);
  // once the scene has scrolled away the nav sits over long-form text, so it
  // takes an ink backdrop to stay legible
  const sceneInView = useInView(sceneRef);

  // no splash for reduced motion: the page still opens from ink with a short fade
  useEffect(() => {
    if (!policy.reducedMotion) return;
    const fade = fadeParallaxFromInk(parallaxRef.current);
    return () => {
      fade?.kill();
    };
  }, [policy.reducedMotion]);

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
      {intro && <IntroSplash ready={ready} onDone={() => setIntro(false)} />}

      {/* the nav outlives the scene: fixed for the whole page, zero height so it
          takes no room. Fixed, and outside the smoother's content — a transformed
          ancestor would turn fixed into absolute */}
      <div className={`pointer-events-none fixed inset-x-0 top-0 ${STACK.nav} h-0`}>
        <nav
          className={`pointer-events-auto absolute inset-x-[clamp(12px,2.4vw,26px)] top-[clamp(12px,2.4vw,26px)] flex flex-wrap items-center justify-between gap-x-6 gap-y-3.5 rounded-[clamp(16px,2.4vw,26px)] px-[clamp(16px,3.4vw,34px)] py-[clamp(16px,2.6vw,26px)] transition-colors duration-500 ${
            sceneInView ? "" : "bg-ink/90 backdrop-blur-sm"
          }`}
        >
          {/* below the tablet breakpoint: the seal mark and a Menu that opens the sheet */}
          <MobileNav className="lg:hidden" activeId={activeId} onNavigate={jumpTo} />
          <NavLinks items={site.nav} activeId={activeId} onNavigate={jumpTo} className="hidden lg:flex" />
          <div className="hidden items-center gap-3 lg:flex">
            <a
              href="#give"
              onClick={(e) => jump(e, "give")}
              className="rounded-full border border-cream/45 px-[22px] py-[11px] text-[11px] uppercase tracking-[0.18em] transition-colors hover:border-cream hover:bg-cream/10"
            >
              Give
            </a>
            <a
              href="#visit"
              onClick={(e) => jump(e, "visit")}
              className="rounded-full bg-seal px-6 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-cream transition-colors hover:bg-seal-deep"
            >
              Join Sunday
            </a>
          </div>
        </nav>
      </div>

      {/* the section dots, fixed outside the smoother's content like the nav,
          and stacked with it so section copy never covers a dot */}
      <DotRail markers={markers} activeId={activeId} onNavigate={jumpTo} className={STACK.nav} />

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
          own: each carries one step of STACK (layerSplit.ts), which is why
          the border and the wordmark are two layers rather than one. */}
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
            />
          )}
          {/* the front canvas wears the same vignette in its shaders (vignette.ts) */}
          <div aria-hidden className="absolute inset-0" style={{ background: vignetteCss() }} />
        </div>

        {/* the wordmark: stationary chrome under the front canvas, so the
            nearest layers can cross it */}
        <div
          ref={chromeRef}
          className={`pointer-events-none sticky top-0 ${STACK.wordmark} col-start-1 row-start-1 h-[100svh] self-start`}
        >
          <div
            data-hero-lockup=""
            className="absolute bottom-[clamp(22px,4.2vw,52px)] left-[clamp(20px,4.4vw,60px)] right-[clamp(20px,4.4vw,60px)] flex justify-end"
          >
            {/* the seal is live so the stamp can replay on click, resting with its filters off */}
            <Lockup sealVariant="live" interactiveSeal />
          </div>
        </div>

        {/* the front canvas: the floor, the two nearest apostles on the left
            and the embers, drawn from the same scene over the wordmark and
            the hero headline (layerSplit.ts). Transparent, and no pointer
            events, so the seal under it still takes its click */}
        {!fallback && (
          <div
            ref={frontRef}
            data-parallax-front=""
            className={`pointer-events-none sticky top-0 ${STACK.front} col-start-1 row-start-1 h-[100svh] self-start overflow-hidden`}
          >
            <canvas ref={frontCanvasRef} aria-hidden className="absolute inset-0 block h-full w-full" />
          </div>
        )}

        {/* the frame border: stationary chrome above the front canvas */}
        <div
          ref={frameRef}
          className={`pointer-events-none sticky top-0 ${STACK.copy} col-start-1 row-start-1 h-[100svh] self-start`}
        >
          <div
            aria-hidden
            data-scene-frame=""
            className="absolute inset-[clamp(12px,2.4vw,26px)] rounded-[clamp(16px,2.4vw,26px)] border border-cream/35"
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
        <section id={devotions.id} className={`scroll-mt-24 ${gutter} py-[clamp(80px,12vh,140px)]`}>
          <div className="mx-auto flex max-w-[1080px] flex-col gap-10">
            <header className="flex max-w-[640px] flex-col gap-5">
              <p className={kickerCls}>{devotions.kicker}</p>
              <h2 className={`text-[clamp(34px,4.1vw,58px)] leading-[1.06] ${serif}`}>{devotions.heading}</h2>
              <p className="text-lg leading-relaxed text-pretty text-cream/75">{site.devotionsIntro}</p>
            </header>
            <ol className="grid gap-x-10 gap-y-9 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
              {site.devotions.map((d, i) => (
                <li key={d.title} className="flex flex-col gap-3 border-t border-cream/25 pt-5">
                  <p className="text-xs uppercase tracking-[0.16em] text-seal">
                    {String(i + 1).padStart(2, "0")} · {d.refs}
                  </p>
                  <h3 className={`text-[28px] leading-[1.12] ${serif}`}>{d.title}</h3>
                  <p className="text-base leading-relaxed text-cream/70">{d.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id={beliefs.id} className={`scroll-mt-24 ${gutter} py-[clamp(80px,12vh,140px)]`}>
          <div className="mx-auto flex max-w-[1080px] flex-col gap-12">
            <header className="flex max-w-[720px] flex-col gap-5">
              <p className={kickerCls}>{beliefs.kicker}</p>
              <h2 className={`text-[clamp(34px,4.1vw,58px)] leading-[1.06] ${serif}`}>{beliefs.heading}</h2>
            </header>
            <ul className="grid gap-8 md:grid-cols-3">
              {site.beliefPosture.map((p) => (
                <li key={p.ref} className="flex flex-col gap-3 border-t border-cream/25 pt-5">
                  <p className={`text-[22px] leading-snug ${serif}`}>{p.line}</p>
                  <p className="text-sm leading-relaxed text-cream/60">“{p.quote}”</p>
                  <p className="text-xs uppercase tracking-[0.16em] text-seal">{p.ref}</p>
                </li>
              ))}
            </ul>
            <dl className="grid gap-x-10 gap-y-10 md:grid-cols-2">
              {site.beliefs.map((b) => (
                <div key={b.title} className="flex flex-col gap-3">
                  <dt className={`text-[28px] leading-[1.12] ${serif}`}>{b.title}</dt>
                  <dd className="text-base leading-relaxed text-cream/70">{b.body}</dd>
                  <dd className="text-xs uppercase tracking-[0.16em] text-seal">{b.refs}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section id={faq.id} className={`scroll-mt-24 ${gutter} py-[clamp(80px,12vh,140px)]`}>
          <div className="mx-auto flex max-w-[1080px] flex-col gap-10 md:flex-row md:gap-16">
            <header className="flex flex-col gap-5 md:w-1/3">
              <p className={kickerCls}>{faq.kicker}</p>
              <h2 className={`text-[clamp(34px,4.1vw,58px)] leading-[1.06] ${serif}`}>{faq.heading}</h2>
            </header>
            <dl className="flex flex-1 flex-col">
              {site.faq.map((q) => (
                <div key={q.question} className="flex flex-col gap-3 border-t border-cream/25 py-6">
                  <dt className={`text-[26px] leading-[1.15] ${serif}`}>{q.question}</dt>
                  <dd className="text-base leading-relaxed text-cream/70">{q.answer}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section id={messages.id} className={`scroll-mt-24 ${gutter} py-[clamp(80px,12vh,140px)]`}>
          <div className="mx-auto flex max-w-[1080px] flex-col gap-10">
            <header className="flex flex-col gap-5">
              <p className={kickerCls}>{messages.kicker}</p>
              <h2 className={`text-[clamp(34px,4.1vw,58px)] leading-[1.06] ${serif}`}>
                <span className="block text-[11px] uppercase tracking-[0.28em] text-cream/50 font-sans mb-3">
                  Current series
                </span>
                {site.messages.series}
              </h2>
            </header>
            <ol className="grid gap-x-10 gap-y-8 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
              {site.messages.latest.map((m) => (
                <li key={m.href} className="flex flex-col gap-3 border-t border-cream/25 pt-5">
                  <p className="text-xs uppercase tracking-[0.16em] text-seal">
                    {m.date} · {m.passage}
                  </p>
                  <h3 className={`text-[26px] leading-[1.15] ${serif}`}>
                    <a href={m.href} className="transition-colors hover:text-cream/80">
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

        <footer className={`${gutter} border-t border-cream/15 py-[clamp(48px,8vh,80px)]`}>
          <div className="mx-auto grid max-w-[1080px] gap-10 text-sm text-cream/70 md:grid-cols-3">
            <div className="flex flex-col gap-2">
              <p className={`text-[22px] text-cream ${serif}`}>{site.name}</p>
              <p>
                {contact.address.street} {contact.address.suite}
                <br />
                {contact.address.city}
              </p>
              <p>Sunday Worship Gathering · {contact.sunday}</p>
            </div>
            <div className="flex flex-col gap-2">
              <a href={`mailto:${contact.email}`} className="transition-colors hover:text-cream">
                {contact.email}
              </a>
              <p>{contact.pastor.name}, pastor</p>
              <a href={`mailto:${contact.pastor.email}`} className="transition-colors hover:text-cream">
                {contact.pastor.email}
              </a>
            </div>
            <div className="flex flex-col gap-2 md:items-end">
              <p className="flex flex-wrap gap-x-4 gap-y-2 text-[11px] uppercase tracking-[0.22em]">
                <span className="text-cream/45">{site.footer.follow}</span>
                {site.socials.map((s) => (
                  <a key={s.href} href={s.href} className="transition-colors hover:text-cream">
                    {s.label}
                  </a>
                ))}
              </p>
              <p className="text-xs text-cream/45">© {site.footer.copyright}</p>
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
 * A section's kicker with the hairline rule under it. The rule is one of the
 * three things the front canvas may cross (with the hero headline and the
 * wordmark); the kicker itself stays above it with the rest of the copy.
 */
function Kicker({ children, className = "", centred = false }: { children: React.ReactNode; className?: string; centred?: boolean }) {
  return (
    <div className={`flex flex-col gap-3 ${centred ? "items-center" : ""} ${className}`}>
      <p className={`${above} text-balance ${kickerCls}`}>{children}</p>
      <hr aria-hidden data-kicker-rule="" className={`relative ${STACK.between} h-px w-12 border-0 bg-cream/30`} />
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
          className={`relative ${STACK.between} max-w-[15ch] text-[clamp(42px,9vw,72px)] leading-[1.02] tracking-[-0.005em] text-pretty lg:text-[clamp(42px,5.6vw,84px)] ${serif}`}
        >
          {s.heading}
        </h1>
      </section>
    );
  }
  if (s.id === "gatherings") {
    return (
      <section id={s.id} data-screen-label={s.label} className={`${base} ${clear} items-center`}>
        {/* three cards stack on a phone, so they tighten up to fit one viewport */}
        <div className="flex w-full max-w-[1080px] flex-col gap-7 md:gap-11">
          <div className="flex flex-col gap-3 md:gap-4">
            <Kicker>{s.kicker}</Kicker>
            <h2 className={`${above} text-[clamp(30px,3.4vw,48px)] leading-[1.06] text-balance ${serif}`}>{s.heading}</h2>
          </div>
          <div className={`${above} grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))] md:gap-10`}>
            {site.gatherings.map((g) => (
              <div key={g.title} className="flex flex-col gap-2 border-t border-cream/25 pt-4 md:gap-3 md:pt-[22px]">
                <h3 className={`text-[24px] leading-[1.12] md:text-[31px] ${serif}`}>{g.title}</h3>
                <p className="text-xs uppercase tracking-[0.16em] text-seal">{g.when}</p>
                <p className="text-sm leading-relaxed text-cream/70 md:text-base">{g.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }
  if (s.id === "give" || s.id === "visit") {
    const { contact } = site;
    // the dove hangs in the upper third of the visit frame; the copy sits under it
    const place =
      s.id === "visit"
        ? "justify-end pb-[clamp(150px,20vh,190px)]"
        : `justify-center ${clear} lg:pb-[clamp(150px,20vh,190px)]`;
    return (
      <section
        id={s.id}
        data-screen-label={s.label}
        className={`${base} flex-col items-center gap-5 text-center md:gap-[26px] ${place}`}
      >
        <Kicker centred>{s.kicker}</Kicker>
        <div className={`${above} flex flex-col items-center gap-5 md:gap-[26px]`}>
          <h2 className={`max-w-[20ch] text-[clamp(40px,5.2vw,76px)] leading-[1.04] text-balance ${serif}`}>{s.heading}</h2>
          {s.body.map((p) => (
            <p key={p} className="max-w-[52ch] text-base leading-relaxed text-pretty text-cream/80 md:text-lg">
              {p}
            </p>
          ))}
          {s.cta && (
            <a
              href={s.cta.href}
              className="rounded-full bg-seal px-[34px] py-4 text-xs font-bold uppercase tracking-[0.2em] text-cream transition-colors hover:bg-seal-deep"
            >
              {s.cta.label}
            </a>
          )}
          {s.id === "visit" && (
            <p className="mt-3.5 text-[10px] uppercase tracking-[0.24em] text-cream/50">
              {contact.address.street} {contact.address.suite} · {contact.address.city}
            </p>
          )}
        </div>
      </section>
    );
  }
  // about and house churches: a single column, left or right of the crowd
  const side = s.id === "house-churches" ? "justify-end" : "";
  return (
    <section id={s.id} data-screen-label={s.label} className={`${base} ${clear} items-center ${side}`}>
      <div className="flex max-w-[600px] flex-col gap-5 md:gap-[26px]">
        <Kicker>{s.kicker}</Kicker>
        <div className={`${above} flex flex-col gap-5 md:gap-[26px]`}>
          <h2 className={`text-[clamp(34px,4.1vw,58px)] leading-[1.06] text-balance ${serif}`}>{s.heading}</h2>
          {s.body.map((p) => (
            <p key={p} className="text-base leading-relaxed text-pretty text-cream/80 md:text-lg">
              {p}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}
