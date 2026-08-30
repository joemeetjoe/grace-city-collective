#!/usr/bin/env node
/**
 * The standing mobile guard (#51): the built site must never be wider than
 * a phone or tablet viewport. Loads the page in the same hardware headless
 * Chrome as cdp-shot.mjs, emulating each device size in turn, and at the top
 * of the page, at every scene section's top and at every long-form section's
 * top asserts
 *
 *   window.innerWidth === <the emulated width>   (Chrome did not zoom out to
 *                                                 fit a wider layout viewport)
 *   document.documentElement.scrollWidth === window.innerWidth
 *
 * On a failure it prints, per waypoint, the widest elements that run past
 * the right edge (tag#id.class and their right edge in CSS px) and exits 1.
 *
 * Usage:
 *   pnpm build && pnpm preview --port 4173 &
 *   node tools/shots/mobile-check.mjs --url http://localhost:4173/ \
 *        [--port 9341] [--sizes 375x667@3,390x844@3,430x932@3,768x1024@2] \
 *        [--settle 600] [--css "..."] [--verbose]
 *
 * --sizes is WxH@dpr, comma-separated; the default is the four devices the
 * mobile issues are checked at (iPhone SE/mini, iPhone 15/16, Pro Max, iPad).
 * --css injects a stylesheet after load (hide a suspect and re-measure).
 * --verbose prints every waypoint's numbers, not only the failing ones.
 * The intro is skipped by pre-setting the session flag, as cdp-shot does.
 */
import { spawn } from "node:child_process";

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > -1 ? process.argv[i + 1] : d;
};
const url = arg("url", "http://localhost:4173/");
const port = Number(arg("port", 9341));
const settle = Number(arg("settle", 600));
const css = arg("css", "");
const verbose = process.argv.includes("--verbose");
const sizes = arg("sizes", "375x667@3,390x844@3,430x932@3,768x1024@2")
  .split(",")
  .filter(Boolean)
  .map((s) => {
    const [wh, dpr = "3"] = s.split("@");
    const [W, H] = wh.split("x").map(Number);
    return { W, H, dpr: Number(dpr) };
  });
const chrome = arg(
  "chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
);

const proc = spawn(chrome, [
  "--headless=new",
  "--ignore-gpu-blocklist",
  "--enable-gpu",
  "--hide-scrollbars",
  `--remote-debugging-port=${port}`,
  `--window-size=${sizes[0].W},${sizes[0].H}`,
  `--user-data-dir=/tmp/mobile-check-${port}`,
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
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text ?? "evaluate failed");
  return r.result.value;
};

// the page's own account of its width at the current scroll position, plus
// whatever pokes past the right edge, widest first
const MEASURE = `(() => {
  const innerWidth = window.innerWidth;
  const scrollWidth = document.documentElement.scrollWidth;
  const name = (el) => {
    const cls = typeof el.className === "string" ? el.className.trim().split(/\\s+/).slice(0, 3).join(".") : "";
    return el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (cls ? "." + cls : "");
  };
  const wide = [];
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (r.right > innerWidth + 0.5) wide.push({ el: name(el), right: Math.round(r.right), width: Math.round(r.width) });
  }
  wide.sort((a, b) => b.right - a.right);
  return { innerWidth, scrollWidth, scrollY: Math.round(window.scrollY), wide: wide.slice(0, 8) };
})()`;

const failures = [];
try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Page.addScriptToEvaluateOnNewDocument", {
    source: `try { sessionStorage.setItem("gcc:intro-played", "1"); } catch {}`,
  });
  for (const { W, H, dpr } of sizes) {
    const device = `${W}x${H}@${dpr}`;
    await send("Emulation.setDeviceMetricsOverride", {
      width: W,
      height: H,
      deviceScaleFactor: dpr,
      mobile: true,
      screenWidth: W,
      screenHeight: H,
    });
    await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await send("Page.navigate", { url });
    for (let i = 0; i < 100; i++) {
      const ok = await evaluate(`!!document.querySelector("canvas, [data-poster]") && document.readyState === "complete"`);
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
    // the waypoints: the top, then each scene stop and each long-form section by id
    const waypoints = await evaluate(`[
      "top",
      ...Array.from(document.querySelectorAll("section[data-screen-label]"), (s) => s.id),
      ...Array.from(document.querySelectorAll("section[id]:not([data-screen-label])"), (s) => s.id),
    ]`);
    for (const wp of waypoints) {
      await evaluate(`(() => {
        const s = ${JSON.stringify(wp)} === "top" ? null : document.getElementById(${JSON.stringify(wp)});
        const top = s ? s.getBoundingClientRect().top + window.scrollY : 0;
        if (window.__gccScrollTo) window.__gccScrollTo(top); else window.scrollTo({ top, behavior: "instant" });
      })()`);
      await sleep(settle);
      const m = await evaluate(MEASURE);
      const ok = m.innerWidth === W && m.scrollWidth === m.innerWidth;
      const line = `${device} ${wp.padEnd(12)} innerWidth=${m.innerWidth} scrollWidth=${m.scrollWidth} scrollY=${m.scrollY}`;
      if (ok) {
        if (verbose) console.log("ok  ", line);
      } else {
        failures.push({ device, wp, ...m });
        console.log("FAIL", line);
        for (const w of m.wide) console.log(`       right=${w.right} width=${w.width} ${w.el}`);
      }
    }
    console.log(`${device}: ${waypoints.length} waypoints, ${failures.filter((f) => f.device === device).length} failing`);
  }
} finally {
  ws.close();
  proc.kill();
}
if (failures.length) {
  console.error(`\n${failures.length} waypoint(s) wider than the viewport — see FAIL lines above`);
  process.exit(1);
}
console.log("\nmobile-check: the page is never wider than the viewport");
