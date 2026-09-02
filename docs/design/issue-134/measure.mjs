#!/usr/bin/env node
/**
 * The #134 spike's numbers, over the same hardware headless Chrome as
 * tools/shots/cdp-shot.mjs:
 *
 *   --frames   rAF deltas sampled in the page for --seconds (3) at the hero
 *              and at the give stop while the pointer sweeps the viewport
 *              (so the chases keep the loop hot at the tier's active rate),
 *              with the long tasks seen meanwhile; p50/p95 ms and the share
 *              of frames over 20 ms (a dropped 60 Hz frame), and — since a
 *              display quantises those to its refresh — the main thread's
 *              time inside each animation frame: requestAnimationFrame is
 *              wrapped before the page runs, so every callback of a frame
 *              (the engine's tick and its two draws, gsap's ticker) is
 *              timed and summed per frame; p50/p95/mean ms is the CPU
 *              cost, GPU time excluded. The intro is skipped by the
 *              session flag, as the shots do.
 *   --gate     a first visit (the intro plays): ms from navigation to the
 *              store's first progress, to `ready` (the intro gate can open),
 *              to the splash leaving the DOM, and the last texture's
 *              responseEnd — read off window.__gcc.store (state/seam.ts).
 *              --throttle kbps (150 ms rtt) makes the textures the limiter.
 *
 * Usage: node docs/design/issue-134/measure.mjs --url http://localhost:4428/ --port 9288
 *        [--frames | --gate] [--size 1600x900] [--dpr 2] [--mobile] [--seconds 3] [--throttle 0]
 * Prints one JSON object.
 */
import { spawn } from "node:child_process";

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > -1 ? process.argv[i + 1] : d;
};
const url = arg("url", "http://localhost:4173/");
const port = Number(arg("port", 9333));
const [W, H] = arg("size", "1600x900").split("x").map(Number);
const mobile = process.argv.includes("--mobile");
const dpr = Number(arg("dpr", mobile ? 3 : 1));
const seconds = Number(arg("seconds", 3));
const throttleKbps = Number(arg("throttle", 0));
const mode = process.argv.includes("--gate") ? "gate" : "frames";
const chrome = arg("chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");

const proc = spawn(chrome, [
  "--headless=new", "--ignore-gpu-blocklist", "--enable-gpu", "--hide-scrollbars",
  `--remote-debugging-port=${port}`, `--window-size=${W},${H}`, `--user-data-dir=/tmp/cdp-measure-${port}`, "--no-first-run", "about:blank",
], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function targets() {
  for (let i = 0; i < 50; i++) {
    try { return await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch { await sleep(200); }
  }
  throw new Error("chrome did not come up");
}
const page = (await targets()).find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) {
    const { res, rej } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result);
  }
};
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result.value;
const pct = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null; };
const round = (v) => (v == null ? null : Math.round(v * 100) / 100);

// what the store reports, stamped with performance.now(): the first progress, ready
const STORE_WATCH = `(() => {
  const m = (window.__m134 = { progressAt: null, readyAt: null, splashGoneAt: null, ready: false });
  const tick = () => {
    const store = window.__gcc && window.__gcc.store;
    if (!store) return requestAnimationFrame(tick);
    const seen = (s) => {
      if (m.progressAt == null && s.progress > 0) m.progressAt = performance.now();
      if (m.readyAt == null && s.ready) { m.readyAt = performance.now(); m.ready = true; }
    };
    seen(store.getState());
    store.subscribe(seen);
  };
  tick();
  const splash = () => {
    if (!document.querySelector("[data-intro-splash],[data-intro-static]") && document.readyState !== "loading" && m.progressAt != null) m.splashGoneAt = performance.now();
    else requestAnimationFrame(splash);
  };
  splash();
})();`;

try {
  await send("Page.enable");
  await send("Runtime.enable");
  if (mobile) {
    await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: dpr, mobile: true, screenWidth: W, screenHeight: H });
    await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  } else {
    await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: dpr, mobile: false });
  }
  if (mode === "frames") {
    await send("Page.addScriptToEvaluateOnNewDocument", { source: `try { sessionStorage.setItem("gcc:intro-played", "1"); } catch {}` });
    // every rAF callback timed, summed per frame timestamp
    await send("Page.addScriptToEvaluateOnNewDocument", { source: `(() => {
      const raf = window.requestAnimationFrame.bind(window);
      const m = (window.__rafCost = new Map());
      window.requestAnimationFrame = (cb) => raf((t) => {
        const s = performance.now();
        try { return cb(t); } finally { m.set(t, (m.get(t) ?? 0) + (performance.now() - s)); }
      });
    })();` });
  }
  if (throttleKbps) {
    await send("Network.enable");
    await send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (throttleKbps * 1000) / 8, uploadThroughput: (throttleKbps * 1000) / 8 });
  }
  await send("Page.addScriptToEvaluateOnNewDocument", { source: STORE_WATCH });
  await send("Page.navigate", { url });
  // wait for the store to report ready (the scene's textures are in and uploaded)
  for (let i = 0; i < 300; i++) {
    if (await evaluate("!!(window.__m134 && window.__m134.ready)")) break;
    await sleep(100);
  }
  const bundle = await evaluate(`(document.querySelector("script[type='module'][src*='/assets/']")?.getAttribute("src") ?? "")`);
  const engine = await evaluate(`performance.getEntriesByType("resource").map((e) => e.name).find((n) => /Parallax(Fiber)?-[^/]*\\.js$/.test(n)) ?? ""`);
  const out = { mode, url, bundle, engine: engine.replace(/^.*\//, ""), viewport: { width: W, height: H, dpr, mobile }, canvases: await evaluate("document.querySelectorAll('canvas').length") };

  if (mode === "gate") {
    for (let i = 0; i < 200; i++) {
      if (await evaluate("window.__m134.splashGoneAt != null")) break;
      await sleep(100);
    }
    const m = await evaluate(`(() => {
      const tex = performance.getEntriesByType("resource").filter((e) => /\\.(webp|avif)(\\?|$)/.test(e.name));
      const eng = performance.getEntriesByType("resource").find((e) => /Parallax(Fiber)?-[^/]*\\.js$/.test(e.name));
      return { ...window.__m134, textures: tex.length, lastTextureAt: Math.max(...tex.map((e) => e.responseEnd)), engineAt: eng ? eng.responseEnd : null, engineBytes: eng ? eng.encodedBodySize : null };
    })()`);
    out.throttleKbps = throttleKbps;
    out.ms = { engineLanded: round(m.engineAt), firstProgress: round(m.progressAt), lastTexture: round(m.lastTextureAt), ready: round(m.readyAt), readyAfterLastTexture: round(m.readyAt - m.lastTextureAt), splashGone: round(m.splashGoneAt) };
    out.textures = m.textures;
    out.engineBytesOnWire = m.engineBytes;
  } else {
    await sleep(1500);
    const labels = await evaluate(`Array.from(document.querySelectorAll("section[data-screen-label]")).map((s) => s.dataset.screenLabel)`);
    const sample = async (label) => {
      const i = labels.indexOf(label);
      await evaluate(`(() => {
        const s = document.querySelectorAll("section[data-screen-label]")[${i}];
        const top = s.getBoundingClientRect().top + window.scrollY;
        if (window.__gcc?.scrollTo) window.__gcc.scrollTo(top); else window.scrollTo({ top, behavior: "instant" });
      })()`);
      await sleep(1800);
      await evaluate(`(() => {
        const m = (window.__f134 = { deltas: [], longTasks: 0, longMs: 0, running: true });
        try { new PerformanceObserver((l) => { for (const e of l.getEntries()) { m.longTasks++; m.longMs += e.duration; } }).observe({ type: "longtask" }); } catch {}
        let last = performance.now();
        const f = (t) => { m.deltas.push(t - last); last = t; if (m.running) requestAnimationFrame(f); };
        requestAnimationFrame(f);
      })()`);
      const from = await evaluate("performance.now()");
      // the pointer sweeps the viewport: the orbit chase keeps every frame moving
      const t0 = Date.now();
      let k = 0;
      while (Date.now() - t0 < seconds * 1000) {
        const x = (0.5 + 0.35 * Math.sin(k / 6)) * W;
        const y = (0.5 + 0.25 * Math.cos(k / 9)) * H;
        await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
        k++;
        await sleep(40);
      }
      const r = await evaluate(`(() => { const m = window.__f134; m.running = false; return { deltas: m.deltas.slice(1), longTasks: m.longTasks, longMs: m.longMs }; })()`);
      // the main thread inside each animation frame of the window, ms
      const cpu = await evaluate(`[...window.__rafCost].filter(([t]) => t >= ${from}).map(([, d]) => d)`);
      const d = r.deltas;
      return {
        label, frames: d.length, p50: round(pct(d, 0.5)), p95: round(pct(d, 0.95)), max: round(Math.max(...d)),
        over20ms: round((100 * d.filter((x) => x > 20).length) / d.length), longTasks: r.longTasks, longTaskMs: round(r.longMs),
        cpu: { frames: cpu.length, p50: round(pct(cpu, 0.5)), p95: round(pct(cpu, 0.95)), max: round(Math.max(...cpu)), meanMs: round(cpu.reduce((a, b) => a + b, 0) / (cpu.length || 1)) },
      };
    };
    out.seconds = seconds;
    out.stops = [await sample("Hero"), await sample("Give")];
  }
  console.log(JSON.stringify(out));
} finally {
  ws.close();
  proc.kill();
}
