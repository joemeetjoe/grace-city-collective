/**
 * Lighthouse CI over the built site (Vitals 10/13, #112): one config per
 * device class, run from the repo root as
 * `lhci autorun --config=tools/perf/lighthouserc.<profile>.cjs`
 * (`pnpm lighthouse` runs both, tools/perf/lighthouse.mjs).
 *
 * lhci serves dist/ itself and loads index.html three times; the assertions
 * read the median run (lhci's representative run: the one closest to the
 * median FCP and TTI). Reports land in .lighthouseci/<profile>/ with a
 * manifest.json that flags the representative run; CI uploads the whole
 * directory as a workflow artifact so a red run has a trace to read.
 *
 * The page plays the intro splash on a first visit and Lighthouse measures a
 * cold load, so LCP includes the splash. That is expected; #107 and #113
 * are what move it. docs/perf/lighthouse-baseline.md holds the first run.
 */

// Errors: these fail the workflow. Scores are 0..1; the categories must be
// perfect and the layout must not shift beyond noise on a cold load.
const errors = {
  "categories:accessibility": ["error", { minScore: 1 }],
  "categories:seo": ["error", { minScore: 1 }],
  "categories:best-practices": ["error", { minScore: 1 }],
  "cumulative-layout-shift": ["error", { maxNumericValue: 0.01 }],
};

/**
 * The timing metrics, in ms. TBT and Speed Index are errors since #115: each ceiling is the
 * post-batch median (docs/perf/vitals.md) plus a stated margin — roughly
 * 20 % on LCP and Speed Index, a noise floor on TBT (runs spread 0–7 ms on
 * desktop and 50–210 ms on mobile). To raise a ceiling deliberately, change
 * the number in the same PR as the change that needs it and say why in the
 * PR; to see the drift without failing, run `pnpm lighthouse` locally.
 *
 * @param {{ lcp: number, tbt: number, si: number }} ceilings
 */
const timings = ({ lcp, tbt, si }) => ({
  // Largest Contentful Paint: a warning, not an error, and deliberately so.
  // On a first visit the largest paint is the splash headline, inline in the
  // HTML with nothing render-blocking ahead of it, and Lantern cannot price
  // that steadily: the same commit simulates ~755 ms or ~2180 ms of FCP from
  // one run to the next, and LCP follows it between roughly 2.0 and 5.6 s.
  // The browser's own number does not move (27-47 ms on every run of both
  // profiles), so `pnpm paint` (tools/perf/paint.mjs) is the gate that holds
  // this line and CI runs it. The ceiling here still catches a real drift.
  // docs/perf/vitals.md records the measurements.
  "largest-contentful-paint": ["warn", { maxNumericValue: lcp }],
  // Total Blocking Time: main-thread work between FCP and TTI; raise it only
  // with the long task named (docs/perf/main-thread-slices.md lists them).
  "total-blocking-time": ["error", { maxNumericValue: tbt }],
  // Speed Index: how quickly the viewport fills; the splash holds it up on a
  // first visit, so raise it only alongside a splash or hero change.
  "speed-index": ["error", { maxNumericValue: si }],
});

/**
 * @param {string} name the profile, also the report directory under .lighthouseci/
 * @param {object} [settings] Lighthouse settings; none means the mobile default
 * @param {{ lcp: number, tbt: number, si: number }} warn the timing ceilings
 */
const profile = (name, settings, warn) => ({
  ci: {
    collect: {
      // relative to the cwd: lhci runs from the repo root
      staticDistDir: "./dist",
      url: ["http://localhost/index.html"],
      numberOfRuns: 3,
      ...(settings ? { settings } : {}),
    },
    assert: {
      aggregationMethod: "median-run",
      assertions: { ...errors, ...timings(warn) },
    },
    upload: {
      target: "filesystem",
      outputDir: `.lighthouseci/${name}`,
    },
  },
});

module.exports = {
  /** Lighthouse's default: a mid-tier phone on slow 4G, DPR 2.625 */
  // #115: medians 2855 / 53 / 4510 ms on 87498a7; the LCP number is the low
  // mode of a bimodal simulation and warns only (see above)
  mobile: profile("mobile", undefined, { lcp: 3400, tbt: 150, si: 5200 }),
  /** Lighthouse's desktop preset: no CPU/network throttling beyond its defaults */
  // #115: medians 908 / 0 / 1547 ms on 87498a7
  desktop: profile("desktop", { preset: "desktop" }, { lcp: 1100, tbt: 50, si: 1850 }),
};
