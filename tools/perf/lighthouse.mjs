#!/usr/bin/env node
/**
 * Lighthouse CI on both profiles (Vitals 10/13, #112): runs
 * `lhci autorun` with tools/perf/lighthouserc.mobile.cjs and then
 * lighthouserc.desktop.cjs from the repo root, and prints one line per
 * profile — the four category scores and LCP, TBT, Speed Index and CLS of
 * the median run — read back from .lighthouseci/<profile>/manifest.json.
 * Exits 1 if either profile's error assertions failed; warnings only print.
 *
 * Usage:
 *   pnpm build && pnpm lighthouse [--profile mobile|desktop]
 *
 * Needs Chrome; set CHROME_PATH if lhci cannot find it (tools/README.md).
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const LHCI = createRequire(import.meta.url).resolve("@lhci/cli/src/cli.js");
const PROFILES = ["mobile", "desktop"];

const i = process.argv.indexOf("--profile");
const wanted = i > -1 ? [process.argv[i + 1]] : PROFILES;
for (const p of wanted) {
  if (!PROFILES.includes(p)) {
    console.error(`unknown profile ${p}; one of ${PROFILES.join(", ")}`);
    process.exit(2);
  }
}
if (!existsSync(join(ROOT, "dist", "index.html"))) {
  console.error("no dist/index.html: run pnpm build first");
  process.exit(2);
}

/** the lhci exit status per profile */
const status = {};
for (const profile of wanted) {
  const config = join("tools", "perf", `lighthouserc.${profile}.cjs`);
  console.log(`\n== lighthouse: ${profile} (${config})\n`);
  const run = spawnSync(process.execPath, [LHCI, "autorun", `--config=${config}`], {
    cwd: ROOT,
    stdio: "inherit",
  });
  status[profile] = run.status ?? 1;
}

/** the audit's numeric value, in its own unit */
const num = (lhr, id) => lhr.audits[id]?.numericValue;
const ms = (v) => (v === undefined ? "n/a" : `${Math.round(v)}ms`);
const score = (lhr, id) => {
  const s = lhr.categories[id]?.score;
  return s === undefined || s === null ? "n/a" : String(Math.round(s * 100));
};

console.log("\nlighthouse (median run of 3)");
for (const profile of wanted) {
  const manifestPath = join(ROOT, ".lighthouseci", profile, "manifest.json");
  if (!existsSync(manifestPath)) {
    console.log(`  ${profile.padEnd(8)} no report at ${relative(ROOT, manifestPath)}`);
    continue;
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const entry = manifest.find((e) => e.isRepresentativeRun) ?? manifest[0];
  const lhr = JSON.parse(readFileSync(entry.jsonPath, "utf8"));
  const cls = num(lhr, "cumulative-layout-shift");
  console.log(
    `  ${profile.padEnd(8)} perf ${score(lhr, "performance")}  a11y ${score(lhr, "accessibility")}  ` +
      `bp ${score(lhr, "best-practices")}  seo ${score(lhr, "seo")}  ` +
      `LCP ${ms(num(lhr, "largest-contentful-paint"))}  TBT ${ms(num(lhr, "total-blocking-time"))}  ` +
      `SI ${ms(num(lhr, "speed-index"))}  CLS ${cls === undefined ? "n/a" : cls.toFixed(3)}  ` +
      `(${relative(ROOT, entry.htmlPath)})${status[profile] === 0 ? "" : "  FAILED"}`,
  );
}

process.exit(Object.values(status).every((s) => s === 0) ? 0 : 1);
