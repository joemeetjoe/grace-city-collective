#!/usr/bin/env node
/**
 * Measure what the built site sends over the wire, per tier: every response's
 * encoded bytes by category (html, js, css, font, texture), added up to the
 * moment the intro gate can open (the tier's last texture landing) and to
 * network idle, on a cold load and then a warm second load.
 *
 * Serves dist/ itself the way CloudFront does — brotli on text, the deploy
 * workflow's cache headers — and drives hardware headless Chrome over CDP
 * like tools/shots/cdp-shot.mjs. The intro plays (no session flag), so the
 * load is a first visit.
 *
 * Usage:
 *   pnpm build && node tools/perf/transfer.mjs [--json docs/perf/run.json]
 *        [--dist dist] [--tiers desktop,mobile] [--serve-port 4399] [--port 9399]
 *        [--url https://…/]   (measure a deployed site instead of dist/)
 *        [--idle 1500]        (ms of network silence that counts as idle)
 *        [--throttle 1600]    (kbps down, 150 ms rtt: a slow connection, to see the
 *                              order things arrive in; --timeline prints it)
 *        [--no-avif]          (force the AVIF probe's verdict to false before the page
 *                              runs, so the WebP fallback path is measured in the same
 *                              Chrome: src/device/avif.ts reads the preset verdict)
 *        [--reduced-motion]   (emulate prefers-reduced-motion: reduce, so the still
 *                              poster loads in place of the scene: the fallback path)
 *        [--scroll-to faq]    (after idle, scroll to #faq and record what follows as a
 *                              third phase, `late`: the long-form chunk arriving, #111)
 *
 * Desktop is 1600×900 at DPR 2, mobile 390×844 at DPR 1.5 with the mobile
 * flag, so tierFor() picks the 2048 and 1024 tiers respectively. Against a
 * dist/ (not --url) each cold load is also read back through the Vite
 * manifest: which tier its textures came from, and whether the first
 * texture request went out before the shell chunk had landed (#113).
 */
import { spawn, execSync } from "node:child_process";
import { createServer } from "node:http";
import { createReadStream, existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";
import { brotliCompressSync } from "node:zlib";

import { PROFILES, formatTable, formatTimeline, kb, posterResponses, scrollToScript, summarise, textureStartVsShell, textureTiers } from "./transferReport.mjs";

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > -1 ? process.argv[i + 1] : d;
};
const dist = resolve(arg("dist", "dist"));
const servePort = Number(arg("serve-port", 4399));
const cdpPort = Number(arg("port", 9399));
const idleMs = Number(arg("idle", 1500));
const jsonOut = arg("json", "");
const throttleKbps = Number(arg("throttle", 0));
const timeline = process.argv.includes("--timeline");
const reducedMotion = process.argv.includes("--reduced-motion");
const scrollTo = arg("scroll-to", "");
const tierNames = arg("tiers", "desktop,mobile").split(",").filter(Boolean);
const noAvif = process.argv.includes("--no-avif");
// the window property src/device/avif.ts keeps the verdict on (AVIF_VERDICT_KEY)
const AVIF_VERDICT_KEY = "__gccAvif";
const chrome = arg("chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");

// ---- a CloudFront-shaped static server for dist/ ----------------------------
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript",
  ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml",
  ".webp": "image/webp", ".avif": "image/avif", ".png": "image/png", ".jpg": "image/jpeg",
  ".woff": "font/woff", ".woff2": "font/woff2", ".ico": "image/x-icon", ".txt": "text/plain",
};
const COMPRESSIBLE = new Set([".html", ".js", ".mjs", ".css", ".json", ".svg", ".txt"]);
const cacheControl = (path) => {
  if (path.startsWith("/assets/")) return "public, max-age=31536000, immutable";
  if (path === "/index.html") return "public, max-age=60, must-revalidate";
  return "public, max-age=86400";
};

function serveDist() {
  const brotli = new Map();
  const server = createServer((req, res) => {
    let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (path.endsWith("/")) path += "index.html";
    const file = join(dist, path);
    if (!file.startsWith(dist) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404).end();
      return;
    }
    const ext = extname(file).toLowerCase();
    res.setHeader("Content-Type", MIME[ext] ?? "application/octet-stream");
    res.setHeader("Cache-Control", cacheControl(path));
    if (COMPRESSIBLE.has(ext) && /\bbr\b/.test(req.headers["accept-encoding"] ?? "")) {
      if (!brotli.has(file)) brotli.set(file, brotliCompressSync(readFileSync(file)));
      const body = brotli.get(file);
      res.setHeader("Content-Encoding", "br");
      res.setHeader("Content-Length", body.length);
      res.end(body);
      return;
    }
    res.setHeader("Content-Length", statSync(file).size);
    createReadStream(file).pipe(res);
  });
  return new Promise((ok) => server.listen(servePort, "127.0.0.1", () => ok(server)));
}

// ---- chrome over CDP ---------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launchChrome(userDataDir) {
  const proc = spawn(chrome, [
    "--headless=new", "--ignore-gpu-blocklist", "--enable-gpu", "--hide-scrollbars",
    `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${userDataDir}`, "--no-first-run", "about:blank",
  ], { stdio: "ignore" });
  for (let i = 0; i < 50; i++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
      const page = targets.find((t) => t.type === "page");
      if (page) return { proc, page };
    } catch { /* not up yet */ }
    await sleep(200);
  }
  proc.kill();
  throw new Error("chrome did not come up");
}

function connect(page) {
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const listeners = new Map();
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result);
    } else if (msg.method && listeners.has(msg.method)) {
      for (const fn of listeners.get(msg.method)) fn(msg.params);
    }
  };
  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const i = ++id;
      pending.set(i, { res, rej });
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  const on = (method, fn) => {
    listeners.set(method, [...(listeners.get(method) ?? []), fn]);
    return () => listeners.set(method, (listeners.get(method) ?? []).filter((f) => f !== fn));
  };
  const evaluate = async (expression) =>
    (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result.value;
  const open = new Promise((r) => (ws.onopen = r));
  return { ws, send, on, evaluate, open };
}

/**
 * Every response from now on, stamped in ms from `t0` — the first request
 * seen, unless one is given (the late phase keeps the cold load's clock) —
 * until `stop()`. `idle()` is true once nothing is in flight and the
 * network has been silent for idleMs.
 */
function watchNetwork(on, t0 = null) {
  const inflight = new Map(); // requestId → { url, mimeType, fromCache, startedAt }
  const responses = [];
  let last = Date.now();
  const stamp = (t) => Math.round((t - t0) * 1000);
  const handlers = {
    "Network.requestWillBeSent": (p) => {
      // the AVIF probe (src/device/avif.ts) is a data: URI: decoded, never sent
      if (p.request.url.startsWith("data:")) return;
      if (t0 === null) t0 = p.timestamp;
      inflight.set(p.requestId, { url: p.request.url, mimeType: "", fromCache: false, startedAt: stamp(p.timestamp) });
      last = Date.now();
    },
    "Network.requestServedFromCache": (p) => {
      const r = inflight.get(p.requestId);
      if (r) r.fromCache = true;
    },
    "Network.responseReceived": (p) => {
      const r = inflight.get(p.requestId);
      if (!r) return;
      r.mimeType = p.response.mimeType;
      r.status = p.response.status;
      if (p.response.fromDiskCache || p.response.fromMemoryCache || p.response.fromServiceWorker) r.fromCache = true;
    },
    "Network.loadingFinished": (p) => {
      const r = inflight.get(p.requestId);
      if (!r) return;
      inflight.delete(p.requestId);
      responses.push({ ...r, bytes: r.fromCache ? 0 : p.encodedDataLength, finishedAt: stamp(p.timestamp) });
      last = Date.now();
    },
    "Network.loadingFailed": (p) => {
      inflight.delete(p.requestId);
      last = Date.now();
    },
  };
  const offs = Object.entries(handlers).map(([m, fn]) => on(m, fn));
  return {
    responses,
    t0: () => t0,
    idle: () => inflight.size === 0 && Date.now() - last > idleMs,
    stop() {
      for (const off of offs) off();
      responses.sort((a, b) => a.finishedAt - b.finishedAt);
    },
  };
}

/** one navigation: every response until the network has been silent for idleMs */
async function loadOnce({ send, evaluate, on }, url) {
  const net = watchNetwork(on);
  await send("Page.navigate", { url });
  let introDoneAt = null;
  // the splash's G-mark trace begins when IntroSplash mounts over the static splash
  let traceAt = null;
  const traceBegun = () =>
    evaluate(`document.querySelector("[data-intro-splash]") ? Math.round(performance.now()) : null`).catch(() => null);
  const introDone = () =>
    evaluate(
      `document.querySelector("#root > *") != null && document.querySelector("[data-intro-pending]") == null ? Math.round(performance.now()) : null`,
    ).catch(() => null);
  const started = Date.now();
  while (Date.now() - started < 60_000) {
    await sleep(100);
    if (traceAt === null) traceAt = await traceBegun();
    if (introDoneAt === null) introDoneAt = await introDone();
    if (net.responses.length && net.idle()) break;
  }
  net.stop();
  // the intro outlives the network: note when its splash hands off, for the record
  for (let i = 0; introDoneAt === null && i < 75; i++) {
    await sleep(200);
    introDoneAt = await introDone();
  }
  const { responses } = net;
  return { responses, t0: net.t0(), traceAt, introDoneAt, idleAt: responses.at(-1)?.finishedAt ?? null };
}

/**
 * The late phase (#111): after the cold load has gone idle and the intro
 * has handed off, scroll to `#id` and record every response that follows
 * until the network is silent again — on the cold load's clock, so the
 * timeline reads straight through. What a reader's scroll fetches that the
 * first load did not: the long-form chunk.
 */
async function scrollOnce({ evaluate, on }, id, t0) {
  const net = watchNetwork(on, t0);
  const at = await evaluate(scrollToScript(id));
  const started = Date.now();
  while (Date.now() - started < 20_000 && !net.idle()) await sleep(100);
  net.stop();
  const { responses } = net;
  return { id, at, responses, idleAt: responses.at(-1)?.finishedAt ?? null };
}

/** how many texture responses came in each encoding, and their bytes */
function textureFormats(responses) {
  const out = {};
  for (const r of responses) {
    const ext = /\.(avif|webp|png|jpe?g)(\?|$)/.exec(r.url)?.[1];
    if (!ext) continue;
    out[ext] ??= { count: 0, bytes: 0 };
    out[ext].count += 1;
    out[ext].bytes += r.bytes;
  }
  return out;
}

async function measureTier(name, url, userDataDir) {
  const profile = PROFILES[name];
  const { proc, page } = await launchChrome(userDataDir);
  const cdp = connect(page);
  await cdp.open;
  try {
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Network.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: profile.width, height: profile.height, deviceScaleFactor: profile.dpr, mobile: profile.mobile,
      ...(profile.mobile ? { screenWidth: profile.width, screenHeight: profile.height } : {}),
    });
    if (profile.mobile) await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    if (noAvif) {
      await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: `window[${JSON.stringify(AVIF_VERDICT_KEY)}] = false;` });
    }
    if (reducedMotion) {
      await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    }
    if (throttleKbps) {
      await cdp.send("Network.emulateNetworkConditions", {
        offline: false, latency: 150, downloadThroughput: (throttleKbps * 1000) / 8, uploadThroughput: (throttleKbps * 1000) / 8,
      });
    }
    const cold = await loadOnce(cdp, url);
    const viewport = await cdp.evaluate("({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio })");
    const canvas = await cdp.evaluate('!!document.querySelector("canvas")');
    const avif = await cdp.evaluate(`Promise.resolve(window[${JSON.stringify(AVIF_VERDICT_KEY)}])`);
    // what the scroll fetches lands in the cache too: the warm load below is warm for it as well
    const late = scrollTo ? await scrollOnce(cdp, scrollTo, cold.t0) : null;
    await cdp.send("Page.navigate", { url: "about:blank" });
    await sleep(300);
    const warm = await loadOnce(cdp, url);
    return {
      profile, viewport, canvas, avif, formats: textureFormats(cold.responses),
      cold: { ...cold, ...summarise(cold.responses), poster: posterResponses(cold.responses) },
      ...(late ? { late: { ...late, ...summarise(late.responses) } } : {}),
      warm: { ...warm, ...summarise(warm.responses), poster: posterResponses(warm.responses) },
    };
  } finally {
    cdp.ws.close();
    const exited = new Promise((r) => proc.once("exit", r));
    proc.kill();
    await exited;
  }
}

// ---- main --------------------------------------------------------------------
const externalUrl = arg("url", "");
const server = externalUrl ? null : await serveDist();
const url = externalUrl || `http://127.0.0.1:${servePort}/`;
// dist/.vite/manifest.json (build.manifest in vite.config.ts): the tier each hashed texture belongs to, and the shell chunk
const manifestPath = join(dist, ".vite", "manifest.json");
const manifest = !externalUrl && existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : null;
const commit = (() => { try { return execSync("git rev-parse --short HEAD").toString().trim(); } catch { return ""; } })();
const run = { commit, date: new Date().toISOString(), url, idleMs, throttleKbps, noAvif, reducedMotion, scrollTo: scrollTo || null, tiers: {} };
try {
  for (const name of tierNames) {
    if (!PROFILES[name]) throw new Error(`unknown tier ${name}`);
    const userDataDir = mkdtempSync(join(tmpdir(), `gcc-transfer-${name}-`));
    try {
      run.tiers[name] = await measureTier(name, url, userDataDir);
    } finally {
      rmSync(userDataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    }
    const t = run.tiers[name];
    if (manifest) {
      t.cold.tiers = textureTiers(t.cold.responses, manifest);
      t.cold.shell = textureStartVsShell(t.cold.responses, manifest["index.html"].file);
    }
    const formats = Object.entries(t.formats).map(([ext, f]) => `${f.count} ${ext} ${(f.bytes / 1024).toFixed(1)} kB`).join(", ");
    console.error(`${name}: dpr ${t.viewport.dpr}, canvas ${t.canvas}, avif ${t.avif}, textures ${formats}, trace ${t.cold.traceAt} ms, gate ${t.cold.gateAt} ms, idle ${t.cold.idleAt} ms, intro done ${t.cold.introDoneAt} ms, warm hits ${t.warm.cached}/${t.warm.responses.length}`);
    console.error(`${name}: dpr ${t.viewport.dpr}, canvas ${t.canvas}, trace ${t.cold.traceAt} ms, gate ${t.cold.gateAt} ms, idle ${t.cold.idleAt} ms, intro done ${t.cold.introDoneAt} ms, warm hits ${t.warm.cached}/${t.warm.responses.length}`);
    for (const p of t.cold.poster) console.error(`${name}: poster ${p.rung}w ${p.format} ${kb(p.bytes)} kB  ${p.path}`);
    if (t.cold.tiers) {
      const { firstTextureAt, shellDoneAt, beforeShell } = t.cold.shell;
      console.error(`${name}: texture tiers [${t.cold.tiers.join(", ")}], first texture request at ${firstTextureAt} ms, shell landed at ${shellDoneAt} ms: ${beforeShell ? "textures started before the shell finished" : "textures waited on the shell"}`);
    }
    if (t.late) console.error(`${name}: late, after scrolling to #${t.late.id} at ${t.late.at} ms: ${t.late.responses.length} responses, ${kb(t.late.toIdle.total)} kB`);
    if (timeline) {
      const marks = { trace: t.cold.traceAt, gate: t.cold.gateAt, ...(t.late ? { [`scroll #${t.late.id}`]: t.late.at } : {}) };
      const responses = [...t.cold.responses, ...(t.late?.responses ?? [])];
      console.log(`${name} cold load, ms from the first request\n${formatTimeline(responses, marks)}\n`);
    }
  }
} finally {
  server?.close();
}
console.log(`commit ${commit}  ${run.url}${reducedMotion ? "  (prefers-reduced-motion: reduce — the poster path)" : ""}\n`);
console.log(formatTable(run.tiers));
if (jsonOut) {
  writeFileSync(jsonOut, JSON.stringify(run, null, 2) + "\n");
  console.error(`wrote ${jsonOut}`);
}
