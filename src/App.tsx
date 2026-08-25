import PentecostParallax from "@/components/PentecostParallax";

const serif = "[font-family:'Cormorant_Garamond',Georgia,serif]";

const site = {
  name: "Grace City Collective",
  kicker: "Est. 2019 · Downtown",
  headline: "A church for the renewal of the city.",
  address: "Meeting at 123 Placeholder Ave — Downtown",
};

const gatherings = [
  {
    title: "Sunday Gathering",
    when: "Sundays · 10:00 AM",
    body: "Singing, scripture, the table, and a sermon that takes the week seriously.",
  },
  {
    title: "Midweek Table",
    when: "Wednesdays · 6:30 PM",
    body: "Dinner in homes across the city. Bring nothing; bring anyone.",
  },
  {
    title: "Prayer at Dawn",
    when: "Fridays · 6:00 AM",
    body: "Thirty quiet minutes before the city wakes up. Coffee after.",
  },
];

const nav = [
  { label: "About", id: "about" },
  { label: "Gatherings", id: "gatherings" },
  { label: "Community", id: "community" },
];

function jump(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
  e.preventDefault();
  const el = document.getElementById(id);
  if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY, behavior: "smooth" });
}

export default function App() {
  return (
    <div className="relative bg-[#14100e] font-sans text-[#f9f4ed]">
      {/* the scene is sticky, not fixed: it stays put while the sections scroll over it */}
      <div className="sticky top-0 -mb-[100svh] h-[100svh] overflow-hidden">
        <PentecostParallax layerSpread={1.25} />
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_80%_65%_at_50%_38%,transparent_0%,rgba(20,16,14,0.30)_65%,rgba(20,16,14,0.72)_100%)]"
        />
      </div>

      {/* stationary chrome: border, nav, wordmark */}
      <div className="pointer-events-none sticky top-0 z-20 -mb-[100svh] h-[100svh]">
        <div
          aria-hidden
          className="absolute inset-[clamp(12px,2.4vw,26px)] rounded-[clamp(16px,2.4vw,26px)] border border-[#f9f4ed]/35"
        />
        <nav className="pointer-events-auto absolute inset-x-[clamp(12px,2.4vw,26px)] top-[clamp(12px,2.4vw,26px)] flex flex-wrap items-center justify-between gap-x-6 gap-y-3.5 px-[clamp(16px,3.4vw,34px)] py-[clamp(16px,2.6vw,26px)]">
          <div className="flex flex-wrap gap-[clamp(14px,2.4vw,30px)] text-[11px] uppercase tracking-[0.22em] text-[#f9f4ed]/70">
            {nav.map((n) => (
              <a
                key={n.id}
                href={`#${n.id}`}
                onClick={(e) => jump(e, n.id)}
                className="transition-colors hover:text-[#f9f4ed]"
              >
                {n.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <a
              href="#give"
              onClick={(e) => jump(e, "give")}
              className="rounded-full border border-[#f9f4ed]/45 px-[22px] py-[11px] text-[11px] uppercase tracking-[0.18em] transition-colors hover:border-[#f9f4ed] hover:bg-[#f9f4ed]/10"
            >
              Give
            </a>
            <a
              href="#give"
              onClick={(e) => jump(e, "give")}
              className="rounded-full bg-[#d67f48] px-6 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[#241a12] transition-colors hover:bg-[#b2622d]"
            >
              Join Sunday
            </a>
          </div>
        </nav>
        <div className="absolute bottom-[clamp(22px,4.2vw,52px)] left-[clamp(20px,4.4vw,60px)] right-[clamp(20px,4.4vw,60px)] flex items-center gap-[clamp(12px,2vw,26px)]">
          <svg viewBox="0 0 86 86" fill="none" className="h-auto w-[clamp(36px,6vw,86px)] shrink-0">
            <path
              d="M43 4v78M4 43h78M15.7 15.7l54.6 54.6M70.3 15.7L15.7 70.3"
              stroke="#f9f4ed"
              strokeWidth="9"
              strokeLinecap="round"
            />
          </svg>
          <span className={`text-[clamp(30px,7.2vw,108px)] leading-[0.9] tracking-[-0.01em] ${serif}`}>
            Grace City
          </span>
        </div>
      </div>

      {/* every section is exactly one viewport tall — one camera waypoint each */}
      <section
        data-screen-label="Hero"
        className="relative z-10 flex min-h-[100svh] flex-col px-[clamp(20px,4.4vw,60px)] pt-[clamp(112px,17vh,180px)] pb-[clamp(150px,24vh,220px)]"
      >
        <p className="mb-[22px] text-[11px] uppercase tracking-[0.28em] text-[#d67f48]">{site.kicker}</p>
        <h1
          className={`max-w-[15ch] text-[clamp(42px,5.6vw,84px)] leading-[1.02] tracking-[-0.005em] text-pretty ${serif}`}
        >
          {site.headline}
        </h1>
      </section>

      <section
        id="about"
        data-screen-label="About"
        className="relative z-10 flex min-h-[100svh] items-center px-[clamp(20px,4.4vw,60px)]"
      >
        <div className="flex max-w-[640px] flex-col gap-[26px]">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[#d67f48]">Who we are</p>
          <h2 className={`text-[clamp(34px,4.1vw,58px)] leading-[1.06] ${serif}`}>
            An ordinary people, an extraordinary hope.
          </h2>
          <p className="text-lg leading-relaxed text-pretty text-[#f9f4ed]/80">
            We are learning together what it means to love God, love our neighbors, and seek the peace of the city we
            live in — slowly, in public, and with the door open.
          </p>
        </div>
      </section>

      <section
        id="gatherings"
        data-screen-label="Gatherings"
        className="relative z-10 flex min-h-[100svh] items-center px-[clamp(20px,4.4vw,60px)]"
      >
        <div className="flex w-full max-w-[1080px] flex-col gap-11">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[#d67f48]">Gatherings</p>
          <div className="grid gap-10 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
            {gatherings.map((g) => (
              <div key={g.title} className="flex flex-col gap-3 border-t border-[#f9f4ed]/25 pt-[22px]">
                <h3 className={`text-[31px] leading-[1.12] ${serif}`}>{g.title}</h3>
                <p className="text-xs uppercase tracking-[0.16em] text-[#d67f48]">{g.when}</p>
                <p className="text-base leading-relaxed text-[#f9f4ed]/70">{g.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="community"
        data-screen-label="Community"
        className="relative z-10 flex min-h-[100svh] items-center justify-end px-[clamp(20px,4.4vw,60px)]"
      >
        <div className="flex max-w-[560px] flex-col gap-[26px]">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[#d67f48]">Community</p>
          <h2 className={`text-[clamp(34px,4.1vw,58px)] leading-[1.06] ${serif}`}>
            Small rooms, long tables, real names.
          </h2>
          <p className="text-lg leading-relaxed text-pretty text-[#f9f4ed]/80">
            Most of the life of this church happens in homes across the city — a dozen people, a meal, and the slow work
            of knowing one another.
          </p>
        </div>
      </section>

      <section
        id="give"
        data-screen-label="Give"
        className="relative z-10 flex min-h-[100svh] flex-col items-center justify-center gap-[30px] px-[clamp(20px,4.4vw,60px)] pb-[clamp(150px,20vh,190px)] text-center"
      >
        <h2 className={`max-w-[20ch] text-[clamp(40px,5.2vw,76px)] leading-[1.04] ${serif}`}>Come and see.</h2>
        <p className="max-w-[44ch] text-lg leading-relaxed text-[#f9f4ed]/80">
          Sundays at 10:00 AM. There is no right way to arrive, and no wrong time to come back.
        </p>
        <a
          href="#"
          className="rounded-full bg-[#d67f48] px-[34px] py-4 text-xs font-bold uppercase tracking-[0.2em] text-[#241a12] transition-colors hover:bg-[#b2622d]"
        >
          Plan your visit
        </a>
        <p className="mt-3.5 text-[10px] uppercase tracking-[0.24em] text-[#f9f4ed]/50">{site.address}</p>
      </section>
    </div>
  );
}
