import { useEffect, useRef, useState } from "react";

import Lockup from "@/components/Lockup";
import MobileNav from "@/components/MobileNav";
import PentecostParallax from "@/components/PentecostParallax";
import StaticPoster from "@/components/StaticPoster";
import { type SceneSection, type SiteContent } from "@/content/site";
import { useSite } from "@/content/useSite";
import IntroSplash from "@/intro/IntroSplash";
import { readPolicyInputs, shouldPlayIntro } from "@/intro/introPolicy";
import { fadeParallaxFromInk } from "@/intro/restingFade";
import { detectWebgl, shouldUseStaticFallback } from "@/scene/fallback";
import { readSaveData, readTierInputs, tierFor } from "@/scene/tier";
import { jumpTo as scrollJumpTo } from "@/scroll/jump";
import { getScrollDriver } from "@/scroll/position";
import { useSmoothScroll } from "@/scroll/useSmoothScroll";

const serif = "[font-family:'Cormorant_Garamond',Georgia,serif]";
const gutter = "px-[clamp(20px,4.4vw,60px)]";
const kickerCls = "text-[11px] uppercase tracking-[0.28em] text-seal";

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
  const sceneRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  // the smoother's sticky stand-ins; a stable list so the hook runs once
  const [held] = useState(() => [parallaxRef, chromeRef]);
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
      <div className="pointer-events-none fixed inset-x-0 top-0 z-30 h-0">
        <nav
          className={`pointer-events-auto absolute inset-x-[clamp(12px,2.4vw,26px)] top-[clamp(12px,2.4vw,26px)] flex flex-wrap items-center justify-between gap-x-6 gap-y-3.5 rounded-[clamp(16px,2.4vw,26px)] px-[clamp(16px,3.4vw,34px)] py-[clamp(16px,2.6vw,26px)] transition-colors duration-500 ${
            sceneInView ? "" : "bg-ink/90 backdrop-blur-sm"
          }`}
        >
          {/* below the tablet breakpoint: the seal mark and a Menu that opens the sheet */}
          <MobileNav className="lg:hidden" onNavigate={jumpTo} />
          <div className="hidden flex-wrap items-center gap-[clamp(14px,2.4vw,30px)] text-[11px] uppercase tracking-[0.22em] text-cream/70 lg:flex">
            {site.nav.map((n) => (
              <a
                key={n.id}
                href={`#${n.id}`}
                onClick={(e) => jump(e, n.id)}
                className="transition-colors hover:text-cream"
              >
                {n.label}
              </a>
            ))}
          </div>
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
          useSmoothScroll holds these two layers with a scrubbed translate. */}
      <div ref={sceneRef} data-scene="" className="relative grid">
        {/* sticky, not fixed: it stays put while the sections scroll over it */}
        <div
          ref={parallaxRef}
          data-parallax=""
          className="sticky top-0 col-start-1 row-start-1 h-[100svh] self-start overflow-hidden"
        >
          {fallback ? (
            <StaticPoster onReady={() => setReady(true)} />
          ) : (
            <PentecostParallax layerSpread={1.25} tier={tier} onReady={() => setReady(true)} />
          )}
          <div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(ellipse_80%_65%_at_50%_38%,transparent_0%,rgba(20,16,14,0.30)_65%,rgba(20,16,14,0.72)_100%)]"
          />
        </div>

        {/* stationary chrome for the scene: border and wordmark */}
        <div
          ref={chromeRef}
          className="pointer-events-none sticky top-0 z-20 col-start-1 row-start-1 h-[100svh] self-start"
        >
          <div
            aria-hidden
            className="absolute inset-[clamp(12px,2.4vw,26px)] rounded-[clamp(16px,2.4vw,26px)] border border-cream/35"
          />
          <div
            data-hero-lockup=""
            className="absolute bottom-[clamp(22px,4.2vw,52px)] left-[clamp(20px,4.4vw,60px)] right-[clamp(20px,4.4vw,60px)] flex justify-end"
          >
            {/* the seal is live so the stamp can replay on click, resting with its filters off */}
            <Lockup sealVariant="live" interactiveSeal />
          </div>
        </div>

        {/* every scene section is exactly one viewport tall — one camera waypoint each */}
        <div className="relative z-10 col-start-1 row-start-1">
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

/** one viewport of the scene; the layout varies by stop, the words come from site.ts */
function Scene({ section: s }: { section: SceneSection }) {
  const site = useSite();
  const base = `relative z-10 flex min-h-[100svh] ${gutter}`;
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
        <p className={`mb-[22px] text-balance ${kickerCls}`}>{s.kicker}</p>
        <h1
          className={`max-w-[15ch] text-[clamp(42px,9vw,72px)] leading-[1.02] tracking-[-0.005em] text-pretty lg:text-[clamp(42px,5.6vw,84px)] ${serif}`}
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
            <p className={kickerCls}>{s.kicker}</p>
            <h2 className={`text-[clamp(30px,3.4vw,48px)] leading-[1.06] text-balance ${serif}`}>{s.heading}</h2>
          </div>
          <div className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))] md:gap-10">
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
        <p className={kickerCls}>{s.kicker}</p>
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
      </section>
    );
  }
  // about and house churches: a single column, left or right of the crowd
  const side = s.id === "house-churches" ? "justify-end" : "";
  return (
    <section id={s.id} data-screen-label={s.label} className={`${base} ${clear} items-center ${side}`}>
      <div className="flex max-w-[600px] flex-col gap-5 md:gap-[26px]">
        <p className={kickerCls}>{s.kicker}</p>
        <h2 className={`text-[clamp(34px,4.1vw,58px)] leading-[1.06] text-balance ${serif}`}>{s.heading}</h2>
        {s.body.map((p) => (
          <p key={p} className="text-base leading-relaxed text-pretty text-cream/80 md:text-lg">
            {p}
          </p>
        ))}
      </div>
    </section>
  );
}
