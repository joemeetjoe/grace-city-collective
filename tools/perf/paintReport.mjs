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
