#!/usr/bin/env node
/**
 * The static byte budget: what each tier's first load requests, summed from
 * dist/ without a browser, against the ceilings in tools/perf/budget.json.
 * Prints a per-tier, per-category table and exits 1 on any breach; CI runs
 * it on every pull request and push to main (.github/workflows/ci.yml).
 *
 * The files come from Vite's manifest (dist/.vite/manifest.json): the shell
 * chunk and its css, the engine chunk (module-preloaded from the head; a
 * dynamic import that is not, like the long-form chunk, is on demand and
 * not counted), the latin font files, every texture of the tier's
 * src/assets/dore/<width>/ — the colour textures as their AVIF twins (#101:
 * the WebP files are fallback-only, for a browser without AVIF, and never
 * fetched alongside), the masks and depths as lossless WebP — plus
 * index.html and the favicon. A separate poster row holds the fallback
 * path's one image (the ladder rung the tier's viewport picks, in AVIF;
 * #109) against its own ceiling. Bytes are what the CDN sends: brotli for
 * html/js/css/svg, raw for avif/webp/woff2. The same categories and units
 * as `pnpm transfer`, so the two tables compare directly
 * (docs/perf/README.md).
 *
 * Usage:
 *   pnpm build && pnpm budget [--dist dist] [--budget tools/perf/budget.json] [--files]
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join, relative, resolve, sep } from "node:path";

import { kb } from "./transferReport.mjs";
import {
  TIER_POSTER_RUNGS, TIER_WIDTHS, checkBudget, firstLoadFiles, firstLoadPoster, formatBudgetTable, sumByCategory, wireSize,
} from "./budgetReport.mjs";

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > -1 ? process.argv[i + 1] : d;
};
const dist = resolve(arg("dist", "dist"));
const budgetArg = arg("budget", "tools/perf/budget.json");
const budgetPath = resolve(budgetArg);
const listFiles = process.argv.includes("--files");

const manifestPath = join(dist, ".vite", "manifest.json");
if (!existsSync(manifestPath)) {
  console.error(`no ${relative(process.cwd(), manifestPath)}: run pnpm build first (build.manifest in vite.config.ts)`);
  process.exit(2);
}
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const listing = readdirSync(dist, { recursive: true }).map((p) => String(p).split(sep).join("/"));

const budget = JSON.parse(readFileSync(budgetPath, "utf8"));
const ceilings = Object.fromEntries(Object.entries(budget).filter(([k]) => !k.startsWith("_")));

const sizes = new Map();
const sizeOf = (path) => {
  if (!sizes.has(path)) sizes.set(path, wireSize(readFileSync(join(dist, path)), extname(path).slice(1)));
  return sizes.get(path);
};

const totals = {};
for (const [tier, width] of Object.entries(TIER_WIDTHS)) {
  const files = firstLoadFiles(manifest, width, listing).map((f) => ({ ...f, bytes: sizeOf(f.path) }));
  // the fallback path's one image, on its own row outside the scene total
  const poster = firstLoadPoster(manifest, TIER_POSTER_RUNGS[tier]);
  totals[tier] = { ...sumByCategory(files), poster: { bytes: sizeOf(poster.path), count: 1 } };
  if (listFiles) {
    console.log(`${tier}  (kB on the wire, per file)`);
    for (const f of files) console.log(`  ${kb(f.bytes).padStart(8)}  ${f.category.padEnd(7)}  ${f.path}`);
    console.log(`  ${kb(totals[tier].poster.bytes).padStart(8)}  poster   ${poster.path}`);
    console.log("");
  }
}

console.log(formatBudgetTable(totals, ceilings));

const breaches = checkBudget(totals, ceilings);
if (breaches.length) {
  for (const b of breaches) {
    console.error(
      `${b.tier} ${b.category}: ${kb(b.bytes)} kB on the wire is over its ${kb(b.ceiling)} kB ceiling by ${kb(b.bytes - b.ceiling)} kB`,
    );
  }
  console.error(`\nover budget: ${budgetArg} — raise a ceiling only in the PR that needs it, and say why`);
  process.exit(1);
}
console.log(`within budget (${budgetArg})`);
