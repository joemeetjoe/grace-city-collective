/**
 * The pure half of the static byte budget (tools/perf/budget.mjs): what a
 * dist file weighs on the wire, which dist files a tier's first load
 * requests, how they add up per category against the ceilings in
 * tools/perf/budget.json, and the table that prints.
 *
 * Categories and units are those of the transfer measurement
 * (transferReport.mjs), so the two tables compare directly.
 */
import { brotliCompressSync } from "node:zlib";

import { CATEGORIES, classify, kb } from "./transferReport.mjs";

/** the CDN compresses these; everything else (webp, woff2) is already compressed */
const BROTLI = new Set(["html", "js", "mjs", "css", "json", "svg", "txt"]);

/** bytes a file costs on the wire: brotli for text types, raw otherwise */
export function wireSize(buffer, ext) {
  return BROTLI.has(ext.toLowerCase()) ? brotliCompressSync(buffer).length : buffer.length;
}

/** the module whose dynamic import produces the engine chunk (src/device/enginePreload.ts) */
export const ENGINE_ENTRY = "src/engine/PentecostParallax.tsx";

/**
 * The font files the first screen takes, hash-insensitive: the latin faces
 * the transfer baseline (docs/perf/wire-baseline.json) saw load for both
 * tiers. The other unicode ranges and the woff fallbacks ship in dist/ but
 * are only fetched for text outside latin, or by a browser without woff2.
 */
export const FIRST_LOAD_FONTS = ["geist-latin-wght-normal.woff2", "cormorant-garamond-latin-400-normal.woff2"];

/** unhashed files at the dist root that every first load requests, when present */
const ROOT_FILES = ["index.html", "favicon.svg", "favicon.ico"];

const TIER_TEXTURE = /^src\/assets\/dore\/(\d+)\/[^/]+\.webp$/;

/**
 * The dist files (relative paths) a tier's first load requests, in request
 * order, each with its transfer category, read out of Vite's manifest
 * (dist/.vite/manifest.json) and the dist listing: the html and favicon,
 * the shell chunk and its css, every chunk the shell imports — the engine
 * chunk is a dynamic import, module-preloaded from the head (#98) — the
 * latin font files, and every texture of the tier's src/assets/dore/<width>/.
 */
export function firstLoadFiles(manifest, width, listing, fonts = FIRST_LOAD_FONTS) {
  const entry = manifest["index.html"];
  if (!entry?.isEntry) throw new Error("no index.html entry in the Vite manifest (build.manifest in vite.config.ts)");

  const paths = ROOT_FILES.filter((p) => listing.includes(p));

  const chunkKeys = [...(entry.imports ?? []), ...(entry.dynamicImports ?? [])];
  if (!chunkKeys.includes(ENGINE_ENTRY)) throw new Error(`the shell no longer imports ${ENGINE_ENTRY}: no engine chunk to count`);
  paths.push(entry.file, ...(entry.css ?? []));
  for (const key of chunkKeys) {
    const chunk = manifest[key];
    if (!chunk) throw new Error(`no chunk for ${key} in the Vite manifest`);
    paths.push(chunk.file, ...(chunk.css ?? []));
  }

  for (const name of fonts) {
    const hit = Object.entries(manifest).find(([key]) => key.endsWith(`/${name}`));
    if (!hit) throw new Error(`no font ${name} in the Vite manifest`);
    paths.push(hit[1].file);
  }

  const textures = Object.entries(manifest).filter(([key]) => TIER_TEXTURE.exec(key)?.[1] === String(width));
  if (!textures.length) throw new Error(`no textures for the ${width} tier in the Vite manifest`);
  paths.push(...textures.map(([, v]) => v.file));

  return paths.map((path) => ({ path, category: classify(`/${path}`) }));
}

/** sized files ({ category, bytes }) added up per category ({ bytes, count }) with a grand total */
export function sumByCategory(files) {
  const by = Object.fromEntries(CATEGORIES.map((c) => [c, { bytes: 0, count: 0 }]));
  let total = 0;
  for (const { category, bytes } of files) {
    by[category].bytes += bytes;
    by[category].count += 1;
    total += bytes;
  }
  return { ...by, total };
}

const KB = 1024;
const ROWS = [...CATEGORIES, "total"];

const measured = (totals, row) => (row === "total" ? totals.total : totals[row].bytes);

/** a tier's ceiling for one row, in bytes; a budget file missing the tier or the row is an error */
function ceilingBytes(ceilings, tier, row) {
  const kbs = ceilings[tier]?.[row];
  if (typeof kbs !== "number") throw new Error(`budget file has no ${row} ceiling for the ${tier} tier`);
  return kbs * KB;
}

/**
 * Every tier row (a category, or the total) whose wire bytes exceed its
 * ceiling (kB in the budget file): `{ tier, category, bytes, ceiling }`.
 */
export function checkBudget(totals, ceilings) {
  const breaches = [];
  for (const [tier, t] of Object.entries(totals)) {
    for (const row of ROWS) {
      const bytes = measured(t, row);
      const ceiling = ceilingBytes(ceilings, tier, row);
      if (bytes > ceiling) breaches.push({ tier, category: row, bytes, ceiling });
    }
  }
  return breaches;
}

const pad = (s, n) => String(s).padStart(n);

/**
 * The per-tier table: a row per category and the total — files, kB on the
 * wire, the ceiling, the headroom left — with OVER on any breach.
 */
export function formatBudgetTable(totals, ceilings) {
  const lines = [];
  for (const [tier, t] of Object.entries(totals)) {
    lines.push(`${tier}  (kB on the wire)`);
    lines.push(`  ${pad("", 8)} ${pad("files", 6)} ${pad("measured", 9)} ${pad("ceiling", 9)} ${pad("headroom", 9)}`);
    for (const row of ROWS) {
      const bytes = measured(t, row);
      const ceiling = ceilingBytes(ceilings, tier, row);
      const files = row === "total" ? CATEGORIES.reduce((n, c) => n + t[c].count, 0) : t[row].count;
      const over = bytes > ceiling ? "  OVER" : "";
      lines.push(
        `  ${pad(row, 8)} ${pad(files, 6)} ${pad(kb(bytes), 9)} ${pad(kb(ceiling), 9)} ${pad(kb(ceiling - bytes), 9)}${over}`,
      );
    }
    lines.push("");
  }
  return lines.join("\n");
}

/** tier name → the plate width whose textures it loads; mirrors TIERS in src/device/tier.ts (a test guards the drift) */
export const TIER_WIDTHS = { desktop: 2048, mobile: 1024 };
