import { afterEach, describe, expect, it, vi } from "vitest";

import { AVIF_VERDICT_KEY } from "./avif";
import { ENGINE_PRELOAD_ATTR } from "./enginePreload";
import { readFallbackInputs, shouldUseStaticFallback } from "./fallback";
import { REDUCED_MOTION_QUERY } from "./reducedMotion";
import { readTierInputs, tierFor } from "./tier";
import {
  ENTRY_FETCH,
  ENTRY_HERO,
  TIER_PRELOAD_ATTR,
  encodeTier,
  preloadOrder,
  tierPreloadScript,
  tierTextureAssets,
  withHeadScript,
  type TierTexture,
  type TierTextures,
} from "./tierPreload";

/** a small tier: one of each kind plus a second colour texture, in a scrambled order, hashed per tier */
const tier = (h: string): TierTexture[] => [
  { file: "depth-fig0.webp", webp: `depth-fig0-${h}.webp` },
  { file: "map-fig5.webp", webp: `map-fig5-${h}.webp`, avif: `map-fig5-${h}.avif` },
  { file: "masks-cut-0.webp", webp: `masks-cut-0-${h}.webp` },
  { file: "map-arch.webp", webp: `map-arch-${h}.webp`, avif: `map-arch-${h}.avif` },
  { file: "plate-backdrop.webp", webp: `plate-backdrop-${h}.webp`, avif: `plate-backdrop-${h}.avif` },
];
const TIERS_FIXTURE: TierTextures = { "2048": tier("D"), "1024": tier("M") };
const SCRIPT = tierPreloadScript({ dir: "/assets/", tiers: TIERS_FIXTURE, engineHref: "/assets/engine-E.js" });

type Signals = {
  width?: number;
  dpr?: number;
  saveData?: boolean;
  webgl?: boolean;
  reducedMotion?: boolean;
  /** the verdict preset on the window, as a harness does; null leaves the probe to run */
  avif?: boolean | null;
};

type Host = Window & { [AVIF_VERDICT_KEY]?: unknown };
const host = window as Host;

/** run the inline script in a document whose signals read as given, and let the verdict settle */
async function runScript(
  { width = 1600, dpr = 2, saveData = false, webgl = true, reducedMotion = false, avif = true }: Signals = {},
  script = SCRIPT,
) {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () => (webgl ? ({} as RenderingContext) : null),
  );
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) => ({ matches: reducedMotion && query === REDUCED_MOTION_QUERY }) as MediaQueryList,
  );
  Object.defineProperty(navigator, "connection", { value: { saveData }, configurable: true });
  Object.defineProperty(window, "innerWidth", { value: width, configurable: true });
  Object.defineProperty(window, "devicePixelRatio", { value: dpr, configurable: true });
  if (avif !== null) host[AVIF_VERDICT_KEY] = avif;
  new Function(script)();
  await new Promise((r) => setTimeout(r, 0));
  return Array.from(document.head.querySelectorAll<HTMLLinkElement>(`link[${TIER_PRELOAD_ATTR}]`));
}

afterEach(() => {
  document.head.innerHTML = "";
  delete host[AVIF_VERDICT_KEY];
  vi.restoreAllMocks();
});

describe("tierPreloadScript", () => {
  /** the inputs both policies are checked over: every edge of tierFor and each fallback signal */
  const TABLE: Signals[] = [
    { width: 1600, dpr: 2 },
    { width: 390, dpr: 3 },
    { width: 1024, dpr: 1.5 },
    { width: 1023, dpr: 2 },
    { width: 1600, dpr: 1 },
    { width: 1600, dpr: 1.49 },
    { width: 1600, dpr: 0 },
    { width: 1600, dpr: 2, saveData: true },
    { width: 390, dpr: 3, saveData: true },
    { width: 1600, dpr: 2, webgl: false },
    { width: 390, dpr: 3, reducedMotion: true },
    { width: 1600, dpr: 2, reducedMotion: true },
  ];

  it("mirrors the tier and fallback policies over the table: nothing on the poster path, the right tier otherwise", async () => {
    for (const signals of TABLE) {
      const links = await runScript(signals);
      const fallback = shouldUseStaticFallback(readFallbackInputs());
      const expected = tierFor(readTierInputs());
      const hash = expected.textures === "2048" ? "D" : "M";
      if (fallback) {
        expect(links, JSON.stringify(signals)).toEqual([]);
        expect(document.head.querySelector(`link[${ENGINE_PRELOAD_ATTR}]`), JSON.stringify(signals)).toBeNull();
      } else {
        expect(links.length, JSON.stringify(signals)).toBe(5);
        expect(links.every((l) => l.getAttribute("href")?.includes(`-${hash}.`)), JSON.stringify(signals)).toBe(true);
        expect(document.head.querySelector(`link[${ENGINE_PRELOAD_ATTR}]`)?.getAttribute("href")).toBe("/assets/engine-E.js");
      }
      document.head.innerHTML = "";
      vi.restoreAllMocks();
    }
  });

  it("preloads the hero set first, then the rest by name, every link anonymous-crossorigin", async () => {
    const links = await runScript();
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/assets/plate-backdrop-D.avif",
      "/assets/masks-cut-0-D.webp",
      "/assets/map-fig5-D.avif",
      "/assets/depth-fig0-D.webp",
      "/assets/map-arch-D.avif",
    ]);
    expect(links.every((l) => l.rel === "preload" && l.getAttribute("crossorigin") === "anonymous")).toBe(true);
  });

  it("raises the hero set to high fetch priority and lowers the other mask packs, leaving the rest to the browser", async () => {
    const script = tierPreloadScript({
      dir: "/assets/",
      tiers: { "2048": [...tier("D"), { file: "masks-flame-1.webp", webp: "masks-flame-1-D.webp" }], "1024": tier("M") },
      engineHref: "/assets/engine-E.js",
    });
    const links = await runScript({}, script);
    const priority = (stem: string) => links.find((l) => l.getAttribute("href")?.includes(stem))?.getAttribute("fetchpriority");
    expect(priority("plate-backdrop")).toBe("high");
    expect(priority("masks-cut-0")).toBe("high");
    expect(priority("map-fig5")).toBe("high");
    expect(priority("masks-flame-1")).toBe("low");
    expect(priority("depth-fig0")).toBeNull();
    expect(priority("map-arch")).toBeNull();
  });

  it("types each link by its kind: colour as image in the verdict's format, masks as a fetch, depths as webp", async () => {
    const avif = await runScript({ avif: true });
    const byFile = (links: HTMLLinkElement[], stem: string) => links.find((l) => l.getAttribute("href")?.includes(stem))!;
    expect(byFile(avif, "plate-backdrop")).toMatchObject({ type: "image/avif" });
    expect(byFile(avif, "plate-backdrop").getAttribute("as")).toBe("image");
    expect(byFile(avif, "masks-cut-0").getAttribute("as")).toBe("fetch");
    expect(byFile(avif, "masks-cut-0").getAttribute("type")).toBeNull();
    expect(byFile(avif, "depth-fig0")).toMatchObject({ type: "image/webp" });
    expect(byFile(avif, "depth-fig0").getAttribute("href")).toBe("/assets/depth-fig0-D.webp");

    document.head.innerHTML = "";
    vi.restoreAllMocks();
    const webp = await runScript({ avif: false });
    expect(webp.map((l) => l.getAttribute("href"))).toEqual([
      "/assets/plate-backdrop-D.webp",
      "/assets/masks-cut-0-D.webp",
      "/assets/map-fig5-D.webp",
      "/assets/depth-fig0-D.webp",
      "/assets/map-arch-D.webp",
    ]);
    expect(webp.filter((l) => l.getAttribute("as") === "image").every((l) => l.type === "image/webp")).toBe(true);
  });

  it("follows a pending verdict, and adds nothing to a head that already carries tier preloads", async () => {
    let settle!: (v: boolean) => void;
    host[AVIF_VERDICT_KEY] = new Promise<boolean>((r) => (settle = r));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => ({}) as RenderingContext);
    Object.defineProperty(navigator, "connection", { value: {}, configurable: true });
    Object.defineProperty(window, "innerWidth", { value: 1600, configurable: true });
    Object.defineProperty(window, "devicePixelRatio", { value: 2, configurable: true });
    new Function(SCRIPT)();
    expect(document.head.querySelectorAll(`link[${TIER_PRELOAD_ATTR}]`)).toHaveLength(0);
    settle(false);
    await new Promise((r) => setTimeout(r, 0));
    expect(document.head.querySelectorAll(`link[${TIER_PRELOAD_ATTR}]`)).toHaveLength(5);

    new Function(SCRIPT)();
    await new Promise((r) => setTimeout(r, 0));
    expect(document.head.querySelectorAll(`link[${TIER_PRELOAD_ATTR}]`)).toHaveLength(5);
  });

  it("starts the AVIF probe where no verdict is preset, before deciding anything", async () => {
    await runScript({ avif: null, reducedMotion: true });
    expect(host[AVIF_VERDICT_KEY]).toBeInstanceOf(Promise);
  });

  it("carries the hashed names once each under the common prefix, not a url per texture", () => {
    expect(SCRIPT.split("/assets/").length - 1).toBe(2); // the prefix and the engine chunk
    expect(SCRIPT).toContain('"d":"/assets/"');
    expect(SCRIPT).toContain("map-fig5-D.avif");
    expect(SCRIPT).toContain("map-fig5-M.webp");
  });
});

describe("preloadOrder / encodeTier", () => {
  it("ranks the hero set in its own order ahead of the rest, which sort by name", () => {
    expect(preloadOrder(tier("X")).map((t) => t.file)).toEqual([
      "plate-backdrop.webp",
      "masks-cut-0.webp",
      "map-fig5.webp",
      "depth-fig0.webp",
      "map-arch.webp",
    ]);
  });

  it("flags a mask as a fetch and the hero set as hero; a colour texture carries its twin, a depth a lone webp", () => {
    expect(encodeTier(tier("X"))).toEqual([
      [ENTRY_HERO, "plate-backdrop-X.webp", "plate-backdrop-X.avif"],
      [ENTRY_HERO | ENTRY_FETCH, "masks-cut-0-X.webp"],
      [ENTRY_HERO, "map-fig5-X.webp", "map-fig5-X.avif"],
      [0, "depth-fig0-X.webp"],
      [0, "map-arch-X.webp", "map-arch-X.avif"],
    ]);
    expect(encodeTier([{ file: "masks-flame-1.webp", webp: "masks-flame-1-X.webp" }])).toEqual([[ENTRY_FETCH, "masks-flame-1-X.webp"]]);
  });
});

describe("tierTextureAssets", () => {
  const asset = (fileName: string, source: string) => ({ type: "asset", fileName, originalFileNames: [source] });
  const bundle = {
    "assets/index-A.js": { type: "chunk", fileName: "assets/index-A.js" },
    "assets/index-B.css": asset("assets/index-B.css", "/repo/src/index.css"),
    "assets/poster-C.avif": asset("assets/poster-C.avif", "/repo/src/assets/poster/dore-pentecost-dark-640.avif"),
    "assets/map-fig5-D.webp": asset("assets/map-fig5-D.webp", "/repo/src/assets/dore/2048/map-fig5.webp"),
    "assets/map-fig5-E.avif": asset("assets/map-fig5-E.avif", "/repo/src/assets/dore/2048/map-fig5.avif"),
    "assets/masks-cut-0-F.webp": asset("assets/masks-cut-0-F.webp", "/repo/src/assets/dore/2048/masks-cut-0.webp"),
    "assets/map-fig5-G.webp": asset("assets/map-fig5-G.webp", "/repo/src/assets/dore/1024/map-fig5.webp"),
    "assets/map-fig5-H.avif": { type: "asset", fileName: "assets/map-fig5-H.avif", originalFileName: "src/assets/dore/1024/map-fig5.avif" },
  };

  it("pairs each tier's webp with its avif twin out of the emitted assets, under the one assets directory", () => {
    expect(tierTextureAssets(bundle, "/")).toEqual({
      dir: "/assets/",
      tiers: {
        "2048": [
          { file: "map-fig5.webp", webp: "map-fig5-D.webp", avif: "map-fig5-E.avif" },
          { file: "masks-cut-0.webp", webp: "masks-cut-0-F.webp" },
        ],
        "1024": [{ file: "map-fig5.webp", webp: "map-fig5-G.webp", avif: "map-fig5-H.avif" }],
      },
    });
    expect(tierTextureAssets(bundle, "/grace-city-collective/").dir).toBe("/grace-city-collective/assets/");
  });

  it("is an error when a tier is missing, a texture has no webp, or the files are spread over directories", () => {
    const { "assets/map-fig5-G.webp": g, "assets/map-fig5-H.avif": h, ...noMobile } = bundle;
    expect(() => tierTextureAssets(noMobile, "/")).toThrow(/no 1024 tier textures/);
    expect(() => tierTextureAssets({ ...noMobile, "assets/map-fig5-H.avif": h }, "/")).toThrow(/no webp for 1024\/map-fig5\.webp/);
    expect(() => tierTextureAssets({ ...bundle, "other/map-fig5-G.webp": { ...g, fileName: "other/map-fig5-G.webp" } }, "/")).toThrow(
      /directories/,
    );
  });
});

describe("withHeadScript", () => {
  const page = (head: string) => `<!doctype html><html><head>${head}</head><body><div id="root"></div></body></html>`;

  it("puts the script ahead of the first script or stylesheet link in the head, after what precedes them", () => {
    const html = page(
      '<meta charset="UTF-8">\n    <style>html{}</style>\n    <script type="module" src="/assets/index-A.js"></script>\n    <link rel="stylesheet" href="/assets/index-B.css">',
    );
    const out = withHeadScript(html, "X();");
    expect(out).toContain('<style>html{}</style>\n    <script>X();</script>\n    <script type="module"');
    expect(out.indexOf("<script>X();</script>")).toBeLessThan(out.indexOf('<link rel="stylesheet"'));
  });

  it("goes ahead of a stylesheet or preload link that comes before any script", () => {
    const out = withHeadScript(page('<link rel="icon" href="/f.svg"><link rel="preload" as="style" href="/a.css"><script src="/b.js"></script>'), "X();");
    expect(out).toContain('<link rel="icon" href="/f.svg"><script>X();</script>\n<link rel="preload"');
  });

  it("goes before </head> when the head has neither, and is an error without a head", () => {
    expect(withHeadScript(page("<title>t</title>"), "X();")).toContain("<title>t</title><script>X();</script>\n</head>");
    expect(() => withHeadScript("<html><body></body></html>", "X();")).toThrow(/no <head>/);
  });
});
