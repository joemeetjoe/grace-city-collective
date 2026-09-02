import { describe, expect, it } from "vitest";

import {
  LAYOUT_TASK_MULTIPLIER,
  attributeSamples,
  cpuProfile,
  describeFrame,
  eventFrame,
  makeResolver,
  prettySource,
  sampleSelfTime,
  selfTimeByTraceEvent,
  simulatedLongTasks,
  sourceGroup,
  taskMultiplier,
} from "./longTasksReport.mjs";

/** a Lighthouse task node with the fields the report reads */
const node = (event, { selfTime = 0, children = [], parent, unbounded = false, startTime = 0, duration = 0 } = {}) => {
  const task = { event, selfTime, children, parent, unbounded, startTime, endTime: startTime + duration, duration };
  for (const child of children) child.parent = task;
  return task;
};
const ev = (name, data) => ({ name, args: data ? { data } : {} });

describe("simulatedLongTasks", () => {
  it("keeps top-level bounded tasks at their simulated duration, longest first", () => {
    const short = node(ev("RunTask"), { startTime: 10, duration: 30 });
    const long = node(ev("RunTask"), { startTime: 50, duration: 20 });
    const child = node(ev("FunctionCall"), { duration: 60 });
    const withChild = node(ev("RunTask"), { startTime: 90, duration: 60, children: [child] });
    const open = node(ev("RunTask"), { startTime: 200, duration: 500, unbounded: true });
    const timings = new Map([
      [short.event, { startTime: 3000, duration: 45 }],
      [long.event, { startTime: 3100, duration: 80 }],
      [withChild.event, { startTime: 3200, duration: 120 }],
      [child.event, { startTime: 3200, duration: 120 }],
      [open.event, { startTime: 3300, duration: 1000 }],
    ]);
    const out = simulatedLongTasks([short, long, child, withChild, open], timings, 50);
    expect(out.map((e) => [e.startTime, e.duration, e.simulated])).toEqual([
      [3200, 120, true],
      [3100, 80, true],
    ]);
  });

  it("falls back to the observed timing for a task the simulation dropped, and without a simulation", () => {
    const task = node(ev("RunTask"), { startTime: 40, duration: 55 });
    expect(simulatedLongTasks([task], new Map(), 50)).toEqual([{ task, startTime: 40, duration: 55, simulated: false }]);
    expect(simulatedLongTasks([task], undefined, 50)[0].simulated).toBe(false);
    expect(simulatedLongTasks([task], undefined, 60)).toEqual([]);
  });
});

describe("taskMultiplier", () => {
  it("halves the cpu slowdown for a task that ran layout anywhere in its tree", () => {
    const plain = node(ev("RunTask"), { children: [node(ev("FunctionCall"))] });
    const layout = node(ev("RunTask"), { children: [node(ev("FunctionCall"), { children: [node(ev("Layout"))] })] });
    expect(taskMultiplier(plain, 4)).toBe(4);
    expect(taskMultiplier(layout, 4)).toBe(4 * LAYOUT_TASK_MULTIPLIER);
    expect(LAYOUT_TASK_MULTIPLIER).toBe(0.5);
  });
});

describe("eventFrame and selfTimeByTraceEvent", () => {
  it("names the callback a FunctionCall ran, with its position counted from 0", () => {
    const frame = eventFrame(ev("FunctionCall", { functionName: "tick", url: "http://h/assets/a.js", lineNumber: 1, columnNumber: 10 }));
    expect(frame).toEqual({ name: "FunctionCall", functionName: "tick", url: "http://h/assets/a.js", line: 0, column: 9 });
    expect(eventFrame(ev("Layout"))).toEqual({ name: "Layout", functionName: undefined, url: undefined, line: undefined, column: undefined });
  });

  it("adds up self time by frame across the tree, largest first", () => {
    const call = { functionName: "tick", url: "http://h/a.js", lineNumber: 1, columnNumber: 1 };
    const task = node(ev("RunTask"), {
      selfTime: 1,
      children: [
        node(ev("FunctionCall", call), { selfTime: 5, children: [node(ev("Layout"), { selfTime: 2 })] }),
        node(ev("FunctionCall", call), { selfTime: 4 }),
        node(ev("Layout"), { selfTime: 3 }),
      ],
    });
    expect(selfTimeByTraceEvent(task).map(({ frame, ms }) => [frame.name, ms])).toEqual([
      ["FunctionCall", 9],
      ["Layout", 5],
      ["RunTask", 1],
    ]);
  });
});

/** a trace with one profile on the main thread, chunked on the profiler thread */
const traceWithProfile = () => {
  const frame = (functionName, url, lineNumber = 0, columnNumber = 0) => ({ functionName, url, lineNumber, columnNumber });
  return [
    { name: "Profile", ph: "P", pid: 1, tid: 10, id: "0x1", ts: 1000, args: { data: { startTime: 1000 } } },
    {
      name: "ProfileChunk",
      pid: 1,
      tid: 99,
      id: "0x1",
      ts: 1100,
      args: {
        data: {
          cpuProfile: {
            nodes: [
              { id: 1, callFrame: frame("(root)") },
              { id: 2, parent: 1, callFrame: frame("tick", "http://h/assets/app.js", 0, 20) },
              { id: 3, parent: 2, callFrame: frame("render", "http://h/assets/app.js", 0, 40) },
              { id: 4, parent: 1, callFrame: frame("(program)") },
            ],
            samples: [2, 3, 3],
          },
          timeDeltas: [100, 200, 300],
        },
      },
    },
    {
      name: "ProfileChunk",
      pid: 1,
      tid: 99,
      id: "0x1",
      ts: 1900,
      args: { data: { cpuProfile: { samples: [4, 3] }, timeDeltas: [400, 500] } },
    },
    // another process's profile, ignored
    { name: "Profile", ph: "P", pid: 2, tid: 10, id: "0x1", ts: 1000, args: { data: { startTime: 1000 } } },
    { name: "ProfileChunk", pid: 2, tid: 99, id: "0x1", ts: 1100, args: { data: { cpuProfile: { samples: [1] }, timeDeltas: [1] } } },
  ];
};

describe("cpuProfile and sampleSelfTime", () => {
  it("joins the chunks of the thread's profile into nodes and timestamped samples", () => {
    const profile = cpuProfile(traceWithProfile(), 1, 10);
    expect([...profile.nodes.keys()]).toEqual([1, 2, 3, 4]);
    expect(profile.samples).toEqual([
      { ts: 1100, node: 2 },
      { ts: 1300, node: 3 },
      { ts: 1600, node: 3 },
      { ts: 2000, node: 4 },
      { ts: 2500, node: 3 },
    ]);
    expect(cpuProfile(traceWithProfile(), 1, 11)).toBeNull();
  });

  it("gives each sample the interval to the next one, clipped to the window, in ms", () => {
    const profile = cpuProfile(traceWithProfile(), 1, 10);
    // the whole profile: 2 owns 200 µs, 3 owns 300 + 400 + 0 (last sample, window end), 4 owns 500
    expect(sampleSelfTime(profile, 0, 2500)).toEqual(new Map([[2, 0.2], [3, 0.7], [4, 0.5]]));
    // a window that starts inside a sample's interval does not count it, and clips the last
    expect(sampleSelfTime(profile, 1200, 1800)).toEqual(new Map([[3, 0.5]]));
  });
});

describe("source resolution", () => {
  it("reads a source-map source as src/ path or package path", () => {
    expect(prettySource("../../src/engine/PentecostParallax.tsx")).toBe("src/engine/PentecostParallax.tsx");
    expect(prettySource("../../node_modules/.pnpm/three@0.185.1/node_modules/three/build/three.module.js")).toBe(
      "three/build/three.module.js",
    );
    expect(sourceGroup("src/engine/PentecostParallax.tsx")).toBe("src/engine/PentecostParallax.tsx");
    expect(sourceGroup("three/build/three.module.js")).toBe("three");
    expect(sourceGroup("@scope/pkg/dist/index.js")).toBe("@scope/pkg");
  });

  it("resolves a frame through the map of its script, and prints it either way", () => {
    const map = {
      findEntry: (line, column) =>
        line === 0 && column >= 20 ? { originalSource: "../../src/a.ts", originalLine: 9, name: "tick" } : {},
    };
    const resolve = makeResolver(new Map([["app.js", map]]));
    expect(resolve("http://h/assets/app.js", 0, 25)).toEqual({ source: "src/a.ts", line: 10, name: "tick" });
    expect(resolve("http://h/assets/app.js", 0, 5)).toBeNull();
    expect(resolve("http://h/assets/other.js", 0, 25)).toBeNull();
    expect(resolve(undefined, 0, 25)).toBeNull();
    expect(describeFrame({ functionName: "t", url: "http://h/assets/app.js", line: 0, column: 25 }, resolve)).toBe("t (src/a.ts:10)");
    expect(describeFrame({ functionName: "", url: "http://h/assets/app.js", line: 0, column: 25 }, resolve)).toBe("tick (src/a.ts:10)");
    expect(describeFrame({ functionName: "u", url: "http://h/assets/other.js", line: 0, column: 5 }, resolve)).toBe("u other.js:1:6");
    expect(describeFrame({ functionName: "(program)" }, resolve)).toBe("(program)");
  });
});

describe("attributeSamples", () => {
  it("splits sampled time by leaf frame, by source and by the nearest src/ frame up the stack", () => {
    const profile = cpuProfile(traceWithProfile(), 1, 10);
    const self = sampleSelfTime(profile, 0, 2500);
    // tick (col 20) is app code, render (col 40) is a library
    const resolve = makeResolver(
      new Map([
        [
          "app.js",
          {
            findEntry: (_line, column) =>
              column === 20
                ? { originalSource: "../../src/loop.ts", originalLine: 4, name: "tick" }
                : { originalSource: "../../node_modules/three/build/three.module.js", originalLine: 99 },
          },
        ],
      ]),
    );
    const rounded = (rows) => rows.map(({ key, ms }) => ({ key, ms: Number(ms.toFixed(3)) }));
    const out = attributeSamples(profile, self, resolve);
    expect(rounded(out.frames)).toEqual([
      { key: "render (three/build/three.module.js:100)", ms: 0.7 },
      { key: "(program)", ms: 0.5 },
      { key: "tick (src/loop.ts:5)", ms: 0.2 },
    ]);
    expect(rounded(out.sources)).toEqual([
      { key: "three", ms: 0.7 },
      { key: "(program)", ms: 0.5 },
      { key: "src/loop.ts", ms: 0.2 },
    ]);
    expect(rounded(out.appFrames)).toEqual([
      { key: "tick (src/loop.ts:5)", ms: 0.9 },
      { key: "(no src/ frame on the stack)", ms: 0.5 },
    ]);
  });
});
