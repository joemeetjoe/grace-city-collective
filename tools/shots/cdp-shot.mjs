#!/usr/bin/env node
/**
 * Screenshot the built site at each scene waypoint with hardware-accelerated
 * headless Chrome over CDP. SwiftShader / hidden tabs stall gsap and the
 * damped camera, so this drives a real GPU-backed headless Chrome instead.
 *
 * Usage:
 *   pnpm build && pnpm preview --port 4173 &
 *   node tools/shots/cdp-shot.mjs --url http://localhost:4173/ --out shots/ \
 *        [--port 9333] [--size 1600x900] [--pointer 0.5,0.5] [--settle 1800] \
 *        [--labels Hero,About] [--scroll 0.5]   (fraction of a section)
 *        [--css "section{visibility:hidden}"]   (injected after load)
 *
 * Writes <out>/<index>-<label>.png per `section[data-screen-label]`, plus
 * <out>/state.json with the page's performance.now() at each capture.
 * The intro is skipped by pre-setting the session flag.
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > -1 ? process.argv[i + 1] : d;
};
const url = arg("url", "http://localhost:4173/");
const out = arg("out", "shots");
const port = Number(arg("port", 9333));
const [W, H] = arg("size", "1600x900").split("x").map(Number);
const [px, py] = arg("pointer", "0.5,0.5").split(",").map(Number);
const settle = Number(arg("settle", 1800));
const only = arg("labels", "")?.split(",").filter(Boolean) ?? [];
const scroll = Number(arg("scroll", 0));
const css = arg("css", "");
const chrome = arg(
  "chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
);
mkdirSync(out, { recursive: true });

const proc = spawn(chrome, [
  "--headless=new",
  "--ignore-gpu-blocklist",
  "--enable-gpu",
  "--hide-scrollbars",
  `--remote-debugging-port=${port}`,
  `--window-size=${W},${H}`,
  `--user-data-dir=/tmp/cdp-shot-${port}`,
  "--no-first-run",
  "about:blank",
], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function targets() {
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json`);
      return await r.json();
    } catch {
      await sleep(200);
    }
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
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const i = ++id;
    pending.set(i, { res, rej });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  return r.result.value;
};

try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await send("Page.addScriptToEvaluateOnNewDocument", {
    source: `try { sessionStorage.setItem("gcc:intro-played", "1"); } catch {}`,
  });
  await send("Page.navigate", { url });
  // wait for the scene: the parallax container fades in once textures are ready
  for (let i = 0; i < 100; i++) {
    const ok = await evaluate(`!!document.querySelector("canvas") && document.readyState === "complete"`);
    if (ok) break;
    await sleep(200);
  }
  await sleep(1500);
  if (css) {
    await evaluate(`(() => {
      const s = document.createElement("style");
      s.textContent = ${JSON.stringify(css)};
      document.head.appendChild(s);
    })()`);
  }
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: px * W, y: py * H });

  const labels = await evaluate(
    `Array.from(document.querySelectorAll("section[data-screen-label]")).map(s => s.dataset.screenLabel)`,
  );
  const state = [];
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    if (only.length && !only.includes(label)) continue;
    await evaluate(`(() => {
      const s = document.querySelectorAll("section[data-screen-label]")[${i}];
      const top = s.getBoundingClientRect().top + window.scrollY + s.offsetHeight * ${scroll};
      if (window.__gccScrollTo) window.__gccScrollTo(top); else window.scrollTo({ top, behavior: "instant" });
    })()`);
    await sleep(settle);
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: px * W, y: py * H });
    await sleep(120);
    const shot = await send("Page.captureScreenshot", { format: "png" });
    const file = join(out, `${String(i).padStart(2, "0")}-${label.toLowerCase().replace(/\W+/g, "-")}.png`);
    writeFileSync(file, Buffer.from(shot.data, "base64"));
    state.push({ label, file, t: await evaluate("performance.now()"), scrollY: await evaluate("window.scrollY") });
    console.log("wrote", file);
  }
  writeFileSync(join(out, "state.json"), JSON.stringify(state, null, 2));
} finally {
  ws.close();
  proc.kill();
}
