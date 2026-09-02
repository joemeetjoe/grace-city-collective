/**
 * Every texture of the device's tier, preloaded from an inline head script
 * so the requests start with the HTML and download alongside the bundle
 * (#113). Until now the bundle preloaded six hero textures once it had
 * run; the other cuts and mask packs waited behind its download, parse and
 * mount. The build emits this script into index.html with both tiers'
 * hashed file names; the script decides once, in the head:
 *
 *   1. start the AVIF probe (avif.ts; the bundle reads its verdict later),
 *   2. stand down where the poster stands in — reduced motion, Save-Data,
 *      no WebGL (the guard enginePreload.ts shares, one context probe),
 *   3. module-preload the engine chunk,
 *   4. pick the tier as tierFor does (viewport width, pixel ratio; Save-Data
 *      returned already), and once the verdict is in, append a
 *      <link rel="preload"> for each of that tier's textures — the hero set
 *      first, at high fetch priority — as AVIF or WebP by the verdict, `as`
 *      and `type` by its kind.
 *
 * The links carry TIER_PRELOAD_ATTR, so the bundle's own injector
 * (preload.ts) sees the head has done the work and stays out.
 *
 * DOM-free and relatively imported, like enginePreload.ts: vite.config.ts
 * builds this under the node tsconfig.
 */
import { AVIF_VERDICT_KEY, avifProbeScript } from "./avif";
import { STATIC_FALLBACK_GUARD, engineModulePreload } from "./enginePreload";
import { TIER_LOW_DPR, TIER_NARROW_WIDTH, TIER_TEXTURES } from "./tierPolicy";
import { HERO_TEXTURES, textureKind } from "./textureKinds";

/** marks a link the head script (or the bundle's injector) preloaded a tier texture with */
export const TIER_PRELOAD_ATTR = "data-tier-preload";

/** the plate widths, as the script keys them: TIERS[..].textures */
export type TierWidthKey = (typeof TIER_TEXTURES)[keyof typeof TIER_TEXTURES];

/** one of a tier's textures: its logical name (cuts.json's) and its hashed file names */
export type TierTexture = {
  /** the name cuts.json uses, e.g. `map-fig5.webp` */
  file: string;
  /** the hashed WebP file name under `dir` */
  webp: string;
  /** the hashed AVIF twin's file name, where the tier has one (#101: the colour textures) */
  avif?: string;
};

export type TierTextures = Record<TierWidthKey, TierTexture[]>;

export type TierPreloadInput = {
  /** the url prefix every hashed file sits under, with its trailing slash: `/assets/` */
  dir: string;
  tiers: TierTextures;
  /** the engine chunk's url (enginePreload.ts) */
  engineHref: string;
};

/** the hero set in its own order, then the rest by name */
export function preloadOrder(textures: readonly TierTexture[]): TierTexture[] {
  const rank = (t: TierTexture) => {
    const i = HERO_TEXTURES.indexOf(t.file);
    return i === -1 ? HERO_TEXTURES.length : i;
  };
  return [...textures].sort((a, b) => rank(a) - rank(b) || a.file.localeCompare(b.file));
}

/**
 * A texture as the script carries it: `[flags, webp, avif?]` — flag 1 for
 * the mask packs (as="fetch"), flag 2 for the hero set; the AVIF name only
 * where a twin exists. Names only: the common prefix travels once.
 */
export type PreloadEntry = [number, string] | [number, string, string];

/** the entry flag for a fetch preload (the mask packs) */
export const ENTRY_FETCH = 1;

/** the entry flag for the hero set */
export const ENTRY_HERO = 2;

/** a tier's textures in preload order, encoded for the script */
export function encodeTier(textures: readonly TierTexture[]): PreloadEntry[] {
  return preloadOrder(textures).map(({ file, webp, avif }) => {
    const flags = (textureKind(file) === "mask" ? ENTRY_FETCH : 0) | (HERO_TEXTURES.includes(file) ? ENTRY_HERO : 0);
    return avif ? [flags, webp, avif] : [flags, webp];
  });
}

/**
 * The inline script: the AVIF probe, then — for a device the scene will
 * render on — the engine modulepreload and a preload per texture of its
 * tier. Runs nothing twice: the probe leaves a preset verdict alone, and a
 * head that already carries tier preloads gets none added.
 */
export function tierPreloadScript({ dir, tiers, engineHref }: TierPreloadInput): string {
  const payload = JSON.stringify({ d: dir, "2048": encodeTier(tiers["2048"]), "1024": encodeTier(tiers["1024"]) });
  const attr = JSON.stringify(TIER_PRELOAD_ATTR);
  return (
    avifProbeScript() +
    "(function(){try{" +
    STATIC_FALLBACK_GUARD +
    engineModulePreload(engineHref) +
    // saveData returned above: the narrow or low-DPR test is what remains of tierFor
    `var t=innerWidth<${TIER_NARROW_WIDTH}||(devicePixelRatio||1)<${TIER_LOW_DPR}` +
    `?${JSON.stringify(TIER_TEXTURES.mobile)}:${JSON.stringify(TIER_TEXTURES.desktop)};` +
    `var d=${payload},s=d[t];` +
    `Promise.resolve(window[${JSON.stringify(AVIF_VERDICT_KEY)}]).then(function(a){` +
    `if(document.head.querySelector("link["+${attr}+"]"))return;` +
    "for(var i=0;i<s.length;i++){var e=s[i],f=e[0],v=a&&e[2]?e[2]:e[1];" +
    `var k=document.createElement("link");k.rel="preload";k.setAttribute("as",f&${ENTRY_FETCH}?"fetch":"image");` +
    `if(!(f&${ENTRY_FETCH}))k.type=v===e[2]?"image/avif":"image/webp";` +
    // Chrome fetches an as="image" preload at low priority and an as="fetch"
    // one at high: the hero set is raised so it lands with the shell, the
    // other mask packs lowered so they queue behind it with the rest
    `if(f&${ENTRY_HERO})k.setAttribute("fetchpriority","high");else if(f&${ENTRY_FETCH})k.setAttribute("fetchpriority","low");` +
    // three.js loads images anonymously; a preload with another credentials mode is fetched twice
    `k.href=d.d+v;k.setAttribute("crossorigin","anonymous");k.setAttribute(${attr},"");` +
    "document.head.appendChild(k)}})" +
    "}catch(e){}})();"
  );
}

/** what the build hands transformIndexHtml: the emitted files, keyed by file name (assets carry their sources) */
export type AssetBundleLike = Record<
  string,
  { type: string; fileName: string; originalFileNames?: string[]; originalFileName?: string | null }
>;

/** a tier texture's source path, as Vite records it on the emitted asset: `…/src/assets/dore/<width>/<stem>.<ext>` */
const TIER_SOURCE = /(?:^|[\\/])src[\\/]assets[\\/]dore[\\/](2048|1024)[\\/]([^\\/]+)\.(webp|avif)$/;

/**
 * Both tiers' textures out of the build: every emitted asset whose source
 * is a file of src/assets/dore/<width>/, paired WebP with AVIF twin, and
 * the one directory they all sit in under the site's base. A tier with no
 * textures, a texture with no WebP, or files spread over two directories
 * is an error.
 */
export function tierTextureAssets(bundle: AssetBundleLike, base: string): Pick<TierPreloadInput, "dir" | "tiers"> {
  const found: Record<TierWidthKey, Map<string, TierTexture>> = { "2048": new Map(), "1024": new Map() };
  const dirs = new Set<string>();
  for (const out of Object.values(bundle)) {
    if (out.type !== "asset") continue;
    const sources = out.originalFileNames ?? (out.originalFileName ? [out.originalFileName] : []);
    for (const source of sources) {
      const m = TIER_SOURCE.exec(source);
      if (!m) continue;
      const width = m[1] as TierWidthKey;
      const [, , stem, ext] = m;
      const slash = out.fileName.lastIndexOf("/");
      dirs.add(out.fileName.slice(0, slash + 1));
      const name = out.fileName.slice(slash + 1);
      const file = `${stem}.webp`;
      const entry = found[width].get(file) ?? { file, webp: "" };
      if (ext === "avif") entry.avif = name;
      else entry.webp = name;
      found[width].set(file, entry);
    }
  }
  if (dirs.size !== 1) throw new Error(`tier textures under ${dirs.size} directories in the build, expected one`);
  const tiers = { "2048": [...found["2048"].values()], "1024": [...found["1024"].values()] };
  for (const width of ["2048", "1024"] as const) {
    if (!tiers[width].length) throw new Error(`no ${width} tier textures in the build (src/assets/dore/${width}/)`);
    for (const t of tiers[width]) if (!t.webp) throw new Error(`no webp for ${width}/${t.file} in the build`);
  }
  return { dir: `${base.replace(/\/+$/, "")}/${[...dirs][0]}`, tiers };
}

/**
 * The page with `script` as the first script in its head: inserted ahead of
 * the first <script> or stylesheet / preload / modulepreload <link> there,
 * so the browser sees the texture preloads before the bundle's own tags —
 * and after whatever precedes them (the inline style the splash paints
 * with). A head with none goes before </head>; a page with no head is an
 * error.
 */
export function withHeadScript(html: string, script: string): string {
  const head = /<head\b[^>]*>([\s\S]*?)<\/head>/i.exec(html);
  if (!head) throw new Error("no <head> in index.html to put the preload script in");
  const inner = head[1];
  const firsts = [/<script\b/i, /<link\b[^>]*\srel\s*=\s*["']?(?:stylesheet|preload|modulepreload)\b/i]
    .map((re) => re.exec(inner)?.index)
    .filter((i): i is number => i !== undefined);
  const cut = firsts.length ? Math.min(...firsts) : inner.length;
  const at = head.index + head[0].length - "</head>".length - inner.length + cut;
  const indent = firsts.length ? /[ \t]*$/.exec(html.slice(0, at))?.[0] ?? "" : "";
  return `${html.slice(0, at)}<script>${script}</script>\n${indent}${html.slice(at)}`;
}
