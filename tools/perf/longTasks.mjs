#!/usr/bin/env node
/**
 * What is inside each long task Lighthouse reports (Vitals 12/13, #114):
 * reads a Lighthouse JSON report and the trace saved beside it, reproduces
 * the `long-tasks` audit's selection — top-level tasks at their simulated
 * duration, the same lantern simulation the audit runs — and prints, per
 * task, the trace events it ran (the callback entry points, resolved to
 * source through the build's source maps) and, when the trace carries a
 * CPU profile, where its sampled time went by source, by nearest src/
 * frame and by leaf frame. Observed ms throughout, with what the report
 * makes of them beside: ×4 on mobile, ×2 for a task that ran layout.
 *
 * Lighthouse CI keeps no trace, so the report comes from Lighthouse's own
 * CLI with `--save-assets` against a sourcemapped build:
 *
 *   pnpm exec tsc -b && pnpm exec vite build --sourcemap
 *   pnpm preview --port 4409 --strictPort &
 *   node node_modules/.pnpm/lighthouse@*\/node_modules/lighthouse/cli/index.js \
 *     http://localhost:4409/index.html --save-assets --output=json \
 *     --output-path=out/lh.json --chrome-flags="--headless=new" \
 *     --additional-trace-categories=disabled-by-default-v8.cpu_profiler
 *   node tools/perf/longTasks.mjs out/lh.json [--min 50] [--top 12] [--dist dist]
 *
 * Without the profiler category the report stops at the trace events.
 * docs/perf/main-thread-slices.md holds the run this was written for.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { SourceMap, createRequire } from "node:module";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  attributeSamples, cpuProfile, formatLongTask, makeResolver, sampleSelfTime, simulatedLongTasks,
} from "./longTasksReport.mjs";

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > -1 ? process.argv[i + 1] : d;
};
const reportPath = process.argv[2];
if (!reportPath || reportPath.startsWith("--")) {
  console.error("usage: node tools/perf/longTasks.mjs <lighthouse report.json> [--min 50] [--top 12] [--dist dist]");
  process.exit(2);
}
const min = Number(arg("min", "50"));
const top = Number(arg("top", "12"));
const dist = resolve(arg("dist", "dist"));

const stem = resolve(reportPath).replace(/\.json$/, "");
const tracePath = `${stem}-0.trace.json`;
const logPath = `${stem}-0.devtoolslog.json`;
for (const p of [reportPath, tracePath, logPath]) {
  if (!existsSync(p)) {
    console.error(`no ${p}: run lighthouse with --save-assets so the trace sits beside the report`);
    process.exit(2);
  }
}
const lhr = JSON.parse(readFileSync(reportPath, "utf8"));
const trace = JSON.parse(readFileSync(tracePath, "utf8"));
const devtoolsLog = JSON.parse(readFileSync(logPath, "utf8"));

// Lighthouse is a dependency of @lhci/cli, not of the repo: reach its
// computed artifacts the way lhci does, from @lhci/cli's own node_modules.
const lhciRequire = createRequire(createRequire(import.meta.url).resolve("@lhci/cli/package.json"));
const lighthouse = (p) => import(pathToFileURL(lhciRequire.resolve(`lighthouse/${p}`)).href);
const [{ MainThreadTasks }, { ProcessedTrace }, { PageDependencyGraph }, { LoadSimulator }] = await Promise.all([
  lighthouse("core/computed/main-thread-tasks.js"),
  lighthouse("core/computed/processed-trace.js"),
  lighthouse("core/computed/page-dependency-graph.js"),
  lighthouse("core/computed/load-simulator.js"),
]);

const settings = lhr.configSettings;
const context = { settings, computedCache: new Map() };
const URL = { requestedUrl: lhr.requestedUrl, mainDocumentUrl: lhr.mainDocumentUrl, finalDisplayedUrl: lhr.finalDisplayedUrl };
const [tasks, processed] = await Promise.all([MainThreadTasks.request(trace, context), ProcessedTrace.request(trace, context)]);

// the audit's own timing source under simulated throttling (core/audits/long-tasks.js)
let timingByEvent;
if (settings.throttlingMethod === "simulate") {
  const graph = await PageDependencyGraph.request({ settings, trace, devtoolsLog, URL, SourceMaps: [], fromTrace: false }, context);
  const simulator = await LoadSimulator.request({ devtoolsLog, settings }, context);
  const simulation = simulator.simulate(graph, { label: "long-tasks-diagnostic" });
  timingByEvent = new Map();
  for (const [node, timing] of simulation.nodeTimings.entries()) if (node.type === "cpu") timingByEvent.set(node.event, timing);
}
const cpuMultiplier = settings.throttlingMethod === "simulate" ? settings.throttling.cpuSlowdownMultiplier : 1;

const mapsByFile = new Map();
const assets = join(dist, "assets");
if (existsSync(assets)) {
  for (const file of readdirSync(assets)) {
    if (file.endsWith(".js.map")) mapsByFile.set(file.slice(0, -4), new SourceMap(JSON.parse(readFileSync(join(assets, file), "utf8"))));
  }
}
const resolveFrame = makeResolver(mapsByFile);

const { pid, tid, ts: originTs } = processed.timeOriginEvt;
const profile = cpuProfile(trace.traceEvents, pid, tid);
const reported = lhr.audits["long-tasks"]?.details?.items ?? [];
const longTasks = simulatedLongTasks(tasks, timingByEvent, min);

console.log(
  `${reportPath}: Lighthouse ${lhr.lighthouseVersion}, ${settings.formFactor}, ${settings.throttlingMethod} throttling` +
    ` (cpu ×${cpuMultiplier}); ${longTasks.length} task(s) ≥ ${min} ms; the audit lists ${reported.length}` +
    `${mapsByFile.size ? `; ${mapsByFile.size} source map(s)` : "; no source maps in dist/assets (build with --sourcemap)"}`,
);
longTasks.forEach((entry, i) => {
  const { task } = entry;
  // the audit's row for this task, by simulated start: its attributable url
  const row = reported.find((r) => Math.abs(r.startTime - entry.startTime) < 0.5);
  const url = row?.url ?? task.attributableURLs?.[0] ?? "(unattributed)";
  const start = originTs + task.startTime * 1000;
  const end = originTs + task.endTime * 1000;
  const samples = profile ? attributeSamples(profile, sampleSelfTime(profile, start, end), resolveFrame) : undefined;
  console.log(`\n${formatLongTask(entry, i + 1, url, { cpuMultiplier, top, resolve: resolveFrame, samples })}`);
});
