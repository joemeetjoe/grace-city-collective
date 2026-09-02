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
 * Warnings: the timing metrics, in ms, ceilinged at the first run's median
 * plus roughly 20 % so ordinary noise stays quiet and a regression shows in
 * the log. A warning does not fail the workflow. To raise a ceiling
 * deliberately, change the number in the same PR as the change that needs
 * it and say why in the PR; #115 tightens them to errors once the Vitals
 * batch has landed.
 *
 * @param {{ lcp: number, tbt: number, si: number }} ceilings
 */
const warnings = ({ lcp, tbt, si }) => ({
  // Largest Contentful Paint: on a first visit this is the splash headline
  // (#107); raise it only for a change that paints more before the gate.
  "largest-contentful-paint": ["warn", { maxNumericValue: lcp }],
  // Total Blocking Time: main-thread work between FCP and TTI; raise it only
  // with the long task named (docs/perf/lighthouse-baseline.md lists them).
  "total-blocking-time": ["warn", { maxNumericValue: tbt }],
  // Speed Index: how quickly the viewport fills; the splash holds it up on a
  // first visit, so raise it only alongside a splash or hero change.
  "speed-index": ["warn", { maxNumericValue: si }],
});

/**
 * @param {string} name the profile, also the report directory under .lighthouseci/
 * @param {object} [settings] Lighthouse settings; none means the mobile default
 * @param {{ lcp: number, tbt: number, si: number }} warn the warning ceilings
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
      assertions: { ...errors, ...warnings(warn) },
    },
    upload: {
      target: "filesystem",
      outputDir: `.lighthouseci/${name}`,
    },
  },
});

module.exports = {
  /** Lighthouse's default: a mid-tier phone on slow 4G, DPR 2.625 */
  mobile: profile("mobile", undefined, { lcp: 5000, tbt: 220, si: 4600 }),
  /** Lighthouse's desktop preset: no CPU/network throttling beyond its defaults */
  desktop: profile("desktop", { preset: "desktop" }, { lcp: 750, tbt: 50, si: 1700 }),
};
