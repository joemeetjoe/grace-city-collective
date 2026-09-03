#!/usr/bin/env node
/**
 * The paint gate: the page's largest paint must be the splash headline, from
 * the HTML, in the first frames — the promise Vitals 5/13 (#107) made and the
 * one Lighthouse's simulated LCP cannot hold steady (see paintReport.mjs).
 *
 * Serves dist/ the way tools/perf/transfer.mjs does and loads it once per
 * profile in hardware headless Chrome, reading the browser's own
 * largest-contentful-paint entries. Prints a row per profile and exits 1 on
 * a breach; CI runs it after `pnpm budget`.
 *
 * Usage:
 *   pnpm build && pnpm paint [--dist dist] [--ceiling 400]
 *        [--serve-port 4441] [--port 9341] [--profiles desktop,mobile]
 *        [--chrome <path>]   (else CHROME_PATH, else the usual installs)
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createReadStream, existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";

import { PAINT_PROFILES, checkPaint, formatPaintTable, pickChrome } from "./paintReport.mjs";
import { PROFILES } from "./transferReport.mjs";

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > -1 ? process.argv[i + 1] : d;
};
const dist = resolve(arg("dist", "dist"));
const servePort = Number(arg("serve-port", 4441));
const cdpPort = Number(arg("port", 9341));
const ceilings = { lcpMs: Number(arg("ceiling", 400)) };
const names = arg("profiles", PAINT_PROFILES.join(",")).split(",").filter(Boolean);
const chrome = pickChrome({ flag: arg("chrome", ""), env: process.env.CHROME_PATH, exists: existsSync });

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".svg": "image/svg+xml", ".webp": "image/webp",
  ".avif": "image/avif", ".png": "image/png", ".jpg": "image/jpeg",
  ".woff": "font/woff", ".woff2": "font/woff2", ".ico": "image/x-icon", ".txt": "text/plain",
};

function serveDist() {
  const server = createServer((req, res) => {
    let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (path.endsWith("/")) path += "index.html";
    const file = join(dist, path);
    if (!file.startsWith(dist) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404).end();
      return;
    }
    res.setHeader("Content-Type", MIME[extname(file).toLowerCase()] ?? "application/octet-stream");
    res.setHeader("Content-Length", statSync(file).size);
    createReadStream(file).pipe(res);
  });
  return new Promise((ok) => server.listen(servePort, "127.0.0.1", () => ok(server)));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** the page-side observer: the last LCP entry's element and its time */
const OBSERVER = `(() => {
  window.__paint = { lcpMs: null, element: null };
  const named = (el) => {
    if (!el) return null;
    const tag = el.tagName.toLowerCase();
    const cls = typeof el.className === "string" && el.className ? "." + el.className.trim().split(/\\s+/)[0] : "";
    return tag + cls;
  };
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      window.__paint = {
        lcpMs: Math.round(entry.startTime),
        element: named(entry.element),
        isSplashHeadline: !!entry.element?.closest?.("[data-splash-headline]") || entry.element?.hasAttribute?.("data-splash-headline") || false,
      };
    }
  }).observe({ type: "largest-contentful-paint", buffered: true });
})();`;

async function connect(page) {
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
  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const i = ++id;
      pending.set(i, { res, rej });
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  return { ws, send, evaluate: async (e) => (await send("Runtime.evaluate", { expression: e, returnByValue: true })).result.value };
}

async function measure(name, url) {
  const profile = PROFILES[name];
  const userDataDir = mkdtempSync(join(tmpdir(), `gcc-paint-${name}-`));
  const proc = spawn(chrome, [
    "--headless=new", "--ignore-gpu-blocklist", "--enable-gpu", "--hide-scrollbars",
    `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${userDataDir}`, "--no-first-run", "about:blank",
  ], { stdio: "ignore" });
  try {
    let page;
    for (let i = 0; i < 50 && !page; i++) {
      try {
        page = (await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json()).find((t) => t.type === "page");
      } catch { /* not up yet */ }
      if (!page) await sleep(200);
    }
    if (!page) throw new Error("chrome did not come up");
    const cdp = await connect(page);
    try {
      await cdp.send("Page.enable");
      await cdp.send("Runtime.enable");
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: profile.width, height: profile.height, deviceScaleFactor: profile.dpr, mobile: profile.mobile,
        ...(profile.mobile ? { screenWidth: profile.width, screenHeight: profile.height } : {}),
      });
      await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: OBSERVER });
      await cdp.send("Page.navigate", { url });
      // the splash holds for its minimum run; a later paint would replace the entry
      await sleep(3000);
      return await cdp.evaluate("window.__paint");
    } finally {
      cdp.ws.close();
    }
  } finally {
    const exited = new Promise((r) => proc.once("exit", r));
    proc.kill();
    await exited;
    rmSync(userDataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
}

const server = await serveDist();
const url = `http://127.0.0.1:${servePort}/`;
const run = {};
try {
  for (const name of names) {
    if (!PROFILES[name]) throw new Error(`unknown profile ${name}`);
    run[name] = await measure(name, url);
  }
} finally {
  server.close();
}
console.log(formatPaintTable(run, ceilings));
const breaches = checkPaint(run, ceilings);
if (breaches.length) {
  console.error(`\n${breaches.length} breach${breaches.length > 1 ? "es" : ""}:`);
  for (const b of breaches) console.error(`  ${b}`);
  process.exit(1);
}
console.log("\nthe splash headline is the largest paint on both profiles");
