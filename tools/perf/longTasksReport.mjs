/**
 * The pure half of the long-task attribution (tools/perf/longTasks.mjs):
 * which top-level main-thread tasks Lighthouse's `long-tasks` audit reports
 * under simulated throttling, what each one spent its time on by trace
 * event and by CPU-profiler sample, and how a minified frame resolves to a
 * source file through the build's source maps.
 *
 * Times in are microseconds where they come from the trace (`ts`, `dur`,
 * profile `timeDeltas`) and milliseconds where they come from Lighthouse's
 * task model (`startTime`, `duration`, `selfTime`); every aggregate goes
 * out in milliseconds, observed — that is, unthrottled. Lighthouse's mobile
 * profile multiplies observed CPU time by `cpuSlowdownMultiplier` (4) to
 * get the numbers in its report — halved for a task that performed layout
 * (lantern's layout task multiplier, 0.5); `taskMultiplier()` gives a
 * task's factor and `scaled()` prints both numbers.
 */

/**
 * The long tasks the audit reports: top-level, bounded, at their simulated
 * duration when the simulation has a timing for the task's event (it drops
 * some short tasks) and their observed one otherwise, longest first.
 *
 * @param {Array<{event: object, parent?: object, unbounded?: boolean, startTime: number, duration: number}>} tasks Lighthouse MainThreadTasks
 * @param {Map<object, {startTime: number, duration: number}> | undefined} timingByEvent simulated timings by trace event
 * @param {number} min the shortest simulated duration to keep, ms
 */
export function simulatedLongTasks(tasks, timingByEvent, min = 50) {
  return tasks
    .filter((task) => !task.parent && !task.unbounded)
    .map((task) => {
      const timing = timingByEvent?.get(task.event);
      return timing
        ? { task, startTime: timing.startTime, duration: timing.duration, simulated: true }
        : { task, startTime: task.startTime, duration: task.duration, simulated: false };
    })
    .filter((entry) => entry.duration >= min)
    .sort((a, b) => b.duration - a.duration);
}

/** the callback a trace event names, when it names one (FunctionCall, TimerFire, …) */
export function eventFrame(event) {
  const data = event.args?.data ?? {};
  return {
    name: event.name,
    functionName: data.functionName,
    url: data.url,
    // trace events count lines and columns from 1; profiler call frames from 0
    line: typeof data.lineNumber === "number" ? data.lineNumber - 1 : undefined,
    column: typeof data.columnNumber === "number" ? data.columnNumber - 1 : undefined,
  };
}

/**
 * Self time of every node in a task's tree, by the trace event it ran under,
 * in observed ms, largest first. The top-level RunTask's own self time is
 * the part of the task no child event explains.
 *
 * @param {{event: object, selfTime: number, children: Array<object>}} task
 * @returns {Array<{frame: ReturnType<typeof eventFrame>, ms: number}>}
 */
export function selfTimeByTraceEvent(task) {
  const totals = new Map();
  const walk = (node) => {
    const frame = eventFrame(node.event);
    const key = JSON.stringify(frame);
    const entry = totals.get(key) ?? { frame, ms: 0 };
    entry.ms += node.selfTime;
    totals.set(key, entry);
    for (const child of node.children) walk(child);
  };
  walk(task);
  return [...totals.values()].sort((a, b) => b.ms - a.ms);
}

/**
 * The sampled CPU profile of one thread, out of the `Profile` event the
 * thread emits and the `ProfileChunk` events that share its id (the
 * `disabled-by-default-v8.cpu_profiler` trace category): every call-frame
 * node by id, and every sample with its absolute timestamp in µs.
 *
 * @param {Array<object>} traceEvents
 * @param {number} pid the renderer process
 * @param {number} tid the thread profiled
 * @returns {{ nodes: Map<number, {id: number, parent?: number, callFrame: object}>, samples: Array<{ts: number, node: number}> } | null}
 */
export function cpuProfile(traceEvents, pid, tid) {
  const profile = traceEvents.find((e) => e.name === "Profile" && e.pid === pid && e.tid === tid);
  if (!profile) return null;
  const chunks = traceEvents
    .filter((e) => e.name === "ProfileChunk" && e.pid === pid && e.id === profile.id)
    .sort((a, b) => a.ts - b.ts);
  const nodes = new Map();
  const samples = [];
  let ts = profile.args.data.startTime;
  for (const chunk of chunks) {
    const data = chunk.args.data;
    for (const node of data.cpuProfile?.nodes ?? []) nodes.set(node.id, node);
    const ids = data.cpuProfile?.samples ?? [];
    const deltas = data.timeDeltas ?? [];
    for (let i = 0; i < ids.length; i += 1) {
      ts += deltas[i] ?? 0;
      samples.push({ ts, node: ids[i] });
    }
  }
  return { nodes, samples };
}

/**
 * Self time per profile node inside a window: each sample owns the interval
 * up to the next sample, clipped to the window. Microseconds in, ms out.
 *
 * @param {NonNullable<ReturnType<typeof cpuProfile>>} profile
 * @param {number} startTs µs, absolute
 * @param {number} endTs µs, absolute
 * @returns {Map<number, number>} node id → observed ms
 */
export function sampleSelfTime(profile, startTs, endTs) {
  const out = new Map();
  const { samples } = profile;
  for (let i = 0; i < samples.length; i += 1) {
    const sample = samples[i];
    if (sample.ts < startTs || sample.ts >= endTs) continue;
    const next = samples[i + 1]?.ts ?? endTs;
    const us = Math.min(next, endTs) - sample.ts;
    out.set(sample.node, (out.get(sample.node) ?? 0) + us / 1000);
  }
  return out;
}

/**
 * A source-map source as it is worth reading: the leading `../` stripped,
 * and anything under a node_modules (pnpm's nested layout included) cut
 * down to `<package>/<path in package>`.
 */
export function prettySource(source) {
  const trimmed = source.replace(/^(\.\.\/)+/, "");
  const i = trimmed.lastIndexOf("node_modules/");
  return i === -1 ? trimmed : trimmed.slice(i + "node_modules/".length);
}

/** the package of a pretty source (`@scope/name` or `name`), or the src path itself */
export function sourceGroup(pretty) {
  if (pretty.startsWith("src/")) return pretty;
  const parts = pretty.split("/");
  return parts[0].startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

/**
 * Resolves a minified location to `pretty:line` (and the original name when
 * the map has one) through a map lookup by script basename.
 *
 * @param {Map<string, {findEntry: (line: number, column: number) => object}>} mapsByFile basename → node:module SourceMap
 * @returns {(url: string | undefined, line: number | undefined, column: number | undefined) => {source: string, line: number, name?: string} | null}
 */
export function makeResolver(mapsByFile) {
  return (url, line, column) => {
    if (!url || line === undefined || column === undefined) return null;
    const map = mapsByFile.get(url.slice(url.lastIndexOf("/") + 1));
    if (!map) return null;
    const entry = map.findEntry(line, column);
    if (!entry?.originalSource) return null;
    return { source: prettySource(entry.originalSource), line: entry.originalLine + 1, name: entry.name };
  };
}

/** a call frame or event frame as one line: `fn (pretty:line)` or `fn script:line:col` */
export function describeFrame(frame, resolve) {
  const fn = frame.functionName || "(anonymous)";
  const at = resolve(frame.url, frame.line, frame.column);
  if (at) return `${at.name && !frame.functionName ? at.name : fn} (${at.source}:${at.line})`;
  if (!frame.url) return fn;
  const file = frame.url.slice(frame.url.lastIndexOf("/") + 1);
  return `${fn} ${file}:${(frame.line ?? 0) + 1}:${(frame.column ?? 0) + 1}`;
}

/** a profiler call frame in the shape `eventFrame` gives */
const profileFrame = (node) => ({
  functionName: node.callFrame.functionName,
  url: node.callFrame.url,
  line: node.callFrame.lineNumber,
  column: node.callFrame.columnNumber,
});

/**
 * Where a window's sampled time went, three ways: by the leaf frame that
 * was running (self time), by the source it resolves to (a src/ file or a
 * package), and by the nearest frame up the stack that lives in src/ — the
 * app-level function the time belongs to, however deep it went into a
 * library. Each list is observed ms, largest first.
 *
 * @param {NonNullable<ReturnType<typeof cpuProfile>>} profile
 * @param {Map<number, number>} selfByNode from sampleSelfTime
 * @param {ReturnType<typeof makeResolver>} resolve
 */
export function attributeSamples(profile, selfByNode, resolve) {
  const add = (map, key, ms) => map.set(key, (map.get(key) ?? 0) + ms);
  const frames = new Map();
  const sources = new Map();
  const appFrames = new Map();
  const groupOf = (node) => {
    const at = resolve(node.callFrame.url, node.callFrame.lineNumber, node.callFrame.columnNumber);
    if (at) return sourceGroup(at.source);
    return node.callFrame.url ? node.callFrame.url.slice(node.callFrame.url.lastIndexOf("/") + 1) : node.callFrame.functionName;
  };
  const appFrameOf = (node) => {
    for (let n = node; n; n = n.parent === undefined ? undefined : profile.nodes.get(n.parent)) {
      if (groupOf(n).startsWith("src/")) return describeFrame(profileFrame(n), resolve);
    }
    return "(no src/ frame on the stack)";
  };
  for (const [id, ms] of selfByNode) {
    const node = profile.nodes.get(id);
    if (!node) continue;
    add(frames, describeFrame(profileFrame(node), resolve), ms);
    add(sources, groupOf(node), ms);
    add(appFrames, appFrameOf(node), ms);
  }
  const sorted = (map) => [...map].map(([key, ms]) => ({ key, ms })).sort((a, b) => b.ms - a.ms);
  return { frames: sorted(frames), sources: sorted(sources), appFrames: sorted(appFrames) };
}

/** lantern's factor for a task that ran layout: half the CPU slowdown */
export const LAYOUT_TASK_MULTIPLIER = 0.5;

/**
 * The factor lantern scales a task's observed duration by: the CPU
 * slowdown, halved when any event in the task is a `Layout`.
 *
 * @param {{event: object, children: Array<object>}} task
 * @param {number} cpuMultiplier the profile's cpuSlowdownMultiplier
 */
export function taskMultiplier(task, cpuMultiplier) {
  const hasLayout = (node) => node.event.name === "Layout" || node.children.some(hasLayout);
  return hasLayout(task) ? cpuMultiplier * LAYOUT_TASK_MULTIPLIER : cpuMultiplier;
}

/** an observed ms as Lighthouse's report shows it, under a task's multiplier */
export const scaled = (ms, multiplier) => `${ms.toFixed(1)} (×${multiplier} ${(ms * multiplier).toFixed(0)})`;

/**
 * The printed report for one long task.
 *
 * @param {object} entry from simulatedLongTasks
 * @param {number} index 1-based
 * @param {string} url the audit's attributable url
 * @param {{ cpuMultiplier: number, top: number, resolve: ReturnType<typeof makeResolver>, samples?: ReturnType<typeof attributeSamples> }} opts
 */
export function formatLongTask(entry, index, url, { cpuMultiplier, top, resolve, samples }) {
  const { task } = entry;
  const multiplier = taskMultiplier(task, cpuMultiplier);
  const file = url.slice(url.lastIndexOf("/") + 1);
  const lines = [
    `#${index}  ${entry.simulated ? "simulated" : "observed"} start ${entry.startTime.toFixed(0)} ms, duration ${entry.duration.toFixed(0)} ms` +
      `  (observed ${task.duration.toFixed(1)} ms at ${task.startTime.toFixed(0)} ms, ×${multiplier}${multiplier !== cpuMultiplier ? " as a layout task" : ""})  ${file}`,
    "  trace events, self ms:",
    ...selfTimeByTraceEvent(task)
      .slice(0, top)
      .map(({ frame, ms }) => `    ${frame.name}${frame.url || frame.functionName ? ` ${describeFrame(frame, resolve)}` : ""}  ${scaled(ms, multiplier)}`),
  ];
  if (samples) {
    const list = (title, rows) => [`  ${title}:`, ...rows.slice(0, top).map(({ key, ms }) => `    ${key}  ${scaled(ms, multiplier)}`)];
    lines.push(
      ...list("profile samples by source", samples.sources),
      ...list("profile samples by nearest src/ frame", samples.appFrames),
      ...list("profile samples by leaf frame", samples.frames),
    );
  } else {
    lines.push("  no CPU profile in the trace (run Lighthouse with --additional-trace-categories=disabled-by-default-v8.cpu_profiler)");
  }
  return lines.join("\n");
}
