/**
 * The pure half of the paint check (tools/perf/paint.mjs): what a profile's
 * observed largest paint has to be for the page to keep its promise — the
 * splash headline on screen from the HTML, before any script.
 *
 * Lighthouse cannot hold this line. Its mobile LCP is Lantern's estimate,
 * and on a page whose first paint comes from inline markup with nothing
 * render-blocking that estimate is bimodal: the same commit measures
 * ~755 ms or ~2180 ms of simulated FCP from run to run, and LCP with it
 * (docs/perf/vitals.md). The observed paint does not move: 27–47 ms across
 * every run of both branches. So the gate reads the browser, not the
 * simulation.
 */

/**
 * Where Chrome lives, in the order worth trying: the flag, then CHROME_PATH
 * (which the Lighthouse config also honours), then the usual installs — the
 * Mac desktop app and the Linux packages a CI runner carries. `exists` is
 * injected so this stays testable.
 */
export function pickChrome({ flag, env, exists } = {}) {
  if (flag) return flag;
  if (env) return env;
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
  ];
  const found = candidates.find((path) => exists(path));
  if (!found) throw new Error(`no Chrome to drive; set CHROME_PATH or --chrome. Looked in:\n  ${candidates.join("\n  ")}`);
  return found;
}

/** the profiles a run reports, in table order */
export const PAINT_PROFILES = ["desktop", "mobile"];

/**
 * What is wrong with a run, one line each: a profile that painted nothing,
 * painted something other than the splash headline, or painted it late.
 */
export function checkPaint(run, ceilings) {
  const breaches = [];
  for (const [name, seen] of Object.entries(run)) {
    if (seen.lcpMs == null) {
      breaches.push(`${name}: nothing painted`);
      continue;
    }
    if (!seen.isSplashHeadline) {
      breaches.push(`${name}: the largest paint is ${seen.element}, not the splash headline`);
      continue;
    }
    if (seen.lcpMs > ceilings.lcpMs) {
      breaches.push(`${name}: LCP ${seen.lcpMs} ms is over the ${ceilings.lcpMs} ms ceiling`);
    }
  }
  return breaches;
}

const pad = (s, n) => String(s).padStart(n);

/** a row per profile: the observed paint, its ceiling, and what painted */
export function formatPaintTable(run, ceilings) {
  const lines = [`  ${pad("profile", 8)} ${pad("LCP ms", 8)} ${pad("ceiling", 8)}  element`];
  for (const name of PAINT_PROFILES) {
    const seen = run[name];
    if (!seen) continue;
    lines.push(`  ${pad(name, 8)} ${pad(seen.lcpMs ?? "—", 8)} ${pad(ceilings.lcpMs, 8)}  ${seen.element ?? "—"}`);
  }
  return lines.join("\n");
}
