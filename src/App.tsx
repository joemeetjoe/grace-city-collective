import darkWebp1280 from "@/assets/dore-pentecost-dark-1280.webp";
import darkWebp2048 from "@/assets/dore-pentecost-dark-2048.webp";
import darkJpg from "@/assets/dore-pentecost-dark-2048.jpg";

const serif = "[font-family:Georgia,'Iowan_Old_Style','Times_New_Roman',serif]";

// Inline SVG film-grain (feTurbulence) overlay; unifies the scanned engraving
// with the flat page color at the vignette edges.
const GRAIN_URL =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const site = {
  name: "Grace City Collective",
  tagline: "A church for the renewal of the city",
  nav: ["About", "Gatherings", "Community", "Give"],
  blurb:
    "We are an ordinary people gathered around an extraordinary hope — learning together what it means to love God, love our neighbors, and seek the peace of our city.",
  cta: "Join us Sunday · 10:00 AM",
  address: "Meeting at 123 Placeholder Ave — Downtown",
};

function App() {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#211f1d] text-[#efe6d4]">
      {/* Doré's "The Descent of the Holy Spirit" (1891), scaled to cover, is the page background */}
      <div aria-hidden className="fixed inset-0">
        <img
          src={darkJpg}
          srcSet={`${darkWebp1280} 1280w, ${darkWebp2048} 2048w`}
          sizes="100vw"
          alt=""
          className="h-full w-full scale-110 object-cover brightness-[0.58] contrast-[1.22]"
        />
        {/* vignette recedes the edges so the type stays focal */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_42%,transparent_0%,rgba(20,18,16,0.45)_60%,rgba(15,13,11,0.82)_100%)]" />
      </div>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-20 opacity-[0.09]"
        style={{ backgroundImage: GRAIN_URL }}
      />

      <nav className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-8 py-6 text-[11px] uppercase tracking-[0.3em] text-[#efe6d4]/70">
        <span>{site.name}</span>
        <div className="flex gap-8">
          {site.nav.map((n) => (
            <a key={n} href="#" className="transition-colors hover:text-[#efe6d4]">
              {n}
            </a>
          ))}
        </div>
      </nav>

      <section className="relative z-10 flex min-h-dvh flex-col items-center justify-center px-6">
        {/* glow continuing the beam of light above the dove */}
        <div
          aria-hidden
          className="absolute left-1/2 top-0 h-[70vh] w-[60vw] -translate-x-1/2 bg-[radial-gradient(ellipse_at_top,rgba(240,225,190,0.22),transparent_65%)]"
        />
        <h1 className={`text-center text-[clamp(2.6rem,8vw,5.5rem)] italic leading-none ${serif}`}>
          Grace City
          <span className="not-italic"> Collective</span>
        </h1>
        <p className="mt-10 max-w-md text-center text-sm leading-relaxed text-[#efe6d4]/70">
          {site.tagline}
        </p>
      </section>

      <section className="relative z-10 mx-auto max-w-xl px-6 pb-28 pt-4 text-center">
        <p className={`text-xl leading-relaxed ${serif}`}>{site.blurb}</p>
        <a
          href="#"
          className="mt-10 inline-block border border-[#efe6d4]/40 px-8 py-3 text-xs uppercase tracking-[0.3em] transition-colors hover:border-[#efe6d4] hover:bg-[#efe6d4] hover:text-[#211f1d]"
        >
          {site.cta}
        </a>
        <p className="mt-14 text-[10px] uppercase tracking-[0.25em] text-[#efe6d4]/50">
          {site.address}
        </p>
      </section>
    </div>
  );
}

export default App;
