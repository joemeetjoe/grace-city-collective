#!/usr/bin/env node
/**
 * Where every figure lands on screen at each scene stop, in CSS px, plus the
 * stop's copy panel (or the hero headline): the numbers the panel tucks in
 * App.tsx (TUCK) are fitted to. Needs a debug build, which exposes the
 * layers: VITE_SCENE_DEBUG=1 pnpm build && pnpm preview --port 4173.
 *
 * Usage:
 *   node tools/shots/cdp-rects.mjs --url http://localhost:4173/ --out rects.json \
 *        [--size 1600x900] [--dpr 2] [--mobile] [--port 9340] \
 *        [--bboxes tools/shots/mask-bboxes.json]
 *
 * A figure's rect is its mask's bounding box (mask-bboxes.json: plate
 * fractions [u0, v0, u1, v1], read off public/dore/1024/masks-cut-*.webp
 * with .venv-recut/bin/python at a threshold of 64/255) projected through
 * the live camera — its silhouette sits inside it, so a robe reads wider
 * than it is at a head's height. Same hardware headless Chrome as
 * cdp-shot.mjs, same intro skip.
 */
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > -1 ? process.argv[i + 1] : d; };
const url = arg("url"); const out = arg("out"); const port = Number(arg("port", 9340));
const [W, H] = arg("size", "1600x900").split("x").map(Number);
const mobile = process.argv.includes("--mobile"); const dpr = Number(arg("dpr", mobile ? 3 : 1));
const bboxes = JSON.parse(readFileSync(arg("bboxes", new URL("./mask-bboxes.json", import.meta.url)), "utf8"));
const proc = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", ["--headless=new","--ignore-gpu-blocklist","--enable-gpu","--hide-scrollbars",`--remote-debugging-port=${port}`,`--window-size=${W},${H}`,`--user-data-dir=/tmp/cdp-rects-${port}`,"--no-first-run","about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function targets() { for (let i = 0; i < 50; i++) { try { return await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch { await sleep(200); } } throw new Error("no chrome"); }
const page = (await targets()).find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const msg = JSON.parse(m.data); if (msg.id && pending.has(msg.id)) { const { res, rej } = pending.get(msg.id); pending.delete(msg.id); msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result); } };
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (e) => (await send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true })).result.value;
try {
  await send("Page.enable"); await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: dpr, mobile, screenWidth: W, screenHeight: H });
  await send("Page.addScriptToEvaluateOnNewDocument", { source: `try { sessionStorage.setItem("gcc:intro-played", "1"); } catch {}` });
  await send("Page.navigate", { url });
  for (let i = 0; i < 100; i++) { if (await evaluate(`!!window.__gccScene && document.readyState === "complete"`)) break; await sleep(200); }
  if (!(await evaluate("!!window.__gccScene"))) throw new Error("no window.__gccScene: build with VITE_SCENE_DEBUG=1");
  await sleep(1500);
  const n = await evaluate(`document.querySelectorAll("section[data-screen-label]").length`);
  const result = [];
  for (let i = 0; i < n; i++) {
    await evaluate(`(() => { const s = document.querySelectorAll("section[data-screen-label]")[${i}]; const top = s.getBoundingClientRect().top + window.scrollY; if (window.__gccScrollTo) window.__gccScrollTo(top); else window.scrollTo({ top, behavior: "instant" }); })()`);
    await sleep(2200);
    const r = await evaluate(`(() => {
      const B = ${JSON.stringify(bboxes)};
      const { layers, camera } = window.__gccScene;
      const IW = 16, IH = 16 * (2519 / 2048);
      const rects = {};
      for (const l of layers) {
        const b = B[l.name]; if (!b) continue;
        // the mesh's local plane: plate u -> x, v -> y, at the hero registration (k = (baseZ - z)/baseZ), then the per-frame scale
        const k = l.mesh.scale.x; // scale is (baseZ-zn)/(baseZ-z); the local plane already carries (baseZ-z)/baseZ
        const g = l.mesh.geometry.parameters; // width = (IW/fit)*k0
        const fit = 0.74; const w = g.width * fit, h = g.height * fit;
        const pts = [[b[0], b[1]], [b[2], b[1]], [b[0], b[3]], [b[2], b[3]]].map(([u, v]) => {
          const p = l.mesh.position.clone().set((u - 0.5) * w, (0.5 - v) * h, 0);
          l.mesh.localToWorld(p); p.project(camera);
          return [(p.x + 1) / 2 * innerWidth, (1 - p.y) / 2 * innerHeight];
        });
        const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
        rects[l.name] = { z: l.z, x0: Math.round(Math.min(...xs)), y0: Math.round(Math.min(...ys)), x1: Math.round(Math.max(...xs)), y1: Math.round(Math.max(...ys)) };
      }
      const s = document.querySelectorAll("section[data-screen-label]")[${i}];
      const p = s.querySelector("[data-copy-panel], h1");
      const pr = p.getBoundingClientRect();
      // the words themselves: the union of the panel's text blocks
      const words = [...p.querySelectorAll("p, h1, h2, h3, a")].map((el) => el.getBoundingClientRect());
      const text = words.length
        ? { x0: Math.round(Math.min(...words.map((r) => r.left))), y0: Math.round(Math.min(...words.map((r) => r.top))), x1: Math.round(Math.max(...words.map((r) => r.right))), y1: Math.round(Math.max(...words.map((r) => r.bottom))) }
        : null;
      const cs = getComputedStyle(p);
      return { stop: s.id, panel: { x0: Math.round(pr.left), y0: Math.round(pr.top), x1: Math.round(pr.right), y1: Math.round(pr.bottom), pl: cs.paddingLeft, pr: cs.paddingRight, pb: cs.paddingBottom, ml: cs.marginLeft }, text, rects };
    })()`);
    result.push(r);
    console.log(r.stop, "panel", JSON.stringify(r.panel), "text", JSON.stringify(r.text));
  }
  writeFileSync(out, JSON.stringify({ viewport: [W, H], stops: result }, null, 1));
} finally { ws.close(); proc.kill(); }
