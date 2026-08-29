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
 *        [--at 1.5,2.5] [--profile fig10]
 *
 * --at measures at those scroll positions (sections from the top, fractional:
 * 2.5 is the turn between the house churches row and the gatherings row,
 * layerSplit's stopAt) instead of at each section's top, and reports every
 * copy panel on screen there, not just the section's own. --profile adds a
 * figure's silhouette — its mask's left and right edges per band of rows,
 * read off the mask at 64/255 and projected the same way — for placing a
 * tuck against the figure itself rather than its bounding box.
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
const at = arg("at", "")?.split(",").filter(Boolean).map(Number) ?? [];
const profile = arg("profile", "");
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
  const positions = at.length ? at : Array.from({ length: n }, (_, i) => i);
  const result = [];
  for (const sp of positions) {
    const i = Math.min(n - 1, Math.floor(sp));
    await evaluate(`(() => { const s = document.querySelectorAll("section[data-screen-label]")[${i}]; const r = s.getBoundingClientRect(); const top = r.top + window.scrollY + ${sp - i} * r.height; if (window.__gccScrollTo) window.__gccScrollTo(top); else window.scrollTo({ top, behavior: "instant" }); })()`);
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
      // a figure's silhouette, per band of mask rows: the mask is one channel of a packed texture
      let silhouette = null;
      const P = ${JSON.stringify(profile)};
      const pl = P && layers.find((l) => l.name === P);
      if (pl) {
        const img = pl.mesh.material.uniforms.mask.value.image;
        const ch = pl.mesh.material.uniforms.uMaskChannel.value;
        const channel = [ch.x, ch.y, ch.z, ch.w].indexOf(1);
        const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
        const ctx = c.getContext("2d", { willReadFrequently: true }); ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, c.width, c.height).data;
        const k = pl.mesh.scale.x; const g = pl.mesh.geometry.parameters; const fit = 0.74; const w = g.width * fit, h = g.height * fit;
        const project = (u, v) => { const p = pl.mesh.position.clone().set((u - 0.5) * w, (0.5 - v) * h, 0); pl.mesh.localToWorld(p); p.project(camera); return [(p.x + 1) / 2 * innerWidth, (1 - p.y) / 2 * innerHeight]; };
        const band = Math.max(1, Math.round(c.height / 160));
        silhouette = [];
        for (let y = 0; y < c.height; y += band) {
          let u0 = Infinity, u1 = -Infinity;
          for (let yy = y; yy < Math.min(c.height, y + band); yy++) for (let x = 0; x < c.width; x++) {
            if (data[(yy * c.width + x) * 4 + channel] > 64) { if (x < u0) u0 = x; if (x > u1) u1 = x; }
          }
          if (u1 < 0) continue;
          // the bitmap was decoded flipped (PentecostParallax's ImageBitmapLoader), so row 0 is the plate's foot
          const v = 1 - (y + band / 2) / c.height;
          const a = project(u0 / c.width, v), b = project((u1 + 1) / c.width, v);
          silhouette.push({ y: Math.round((a[1] + b[1]) / 2), x0: Math.round(a[0]), x1: Math.round(b[0]) });
        }
      }
      const s = document.querySelectorAll("section[data-screen-label]")[${i}];
      const measure = (p) => {
        const pr = p.getBoundingClientRect();
        // the words themselves: the union of the panel's text blocks
        const words = [...p.querySelectorAll("p, h1, h2, h3, a")].map((el) => el.getBoundingClientRect());
        const text = words.length
          ? { x0: Math.round(Math.min(...words.map((r) => r.left))), y0: Math.round(Math.min(...words.map((r) => r.top))), x1: Math.round(Math.max(...words.map((r) => r.right))), y1: Math.round(Math.max(...words.map((r) => r.bottom))) }
          : null;
        const cs = getComputedStyle(p);
        return { panel: { x0: Math.round(pr.left), y0: Math.round(pr.top), x1: Math.round(pr.right), y1: Math.round(pr.bottom), pl: cs.paddingLeft, pr: cs.paddingRight, pb: cs.paddingBottom, ml: cs.marginLeft }, text };
      };
      // every copy panel (or hero headline) with any part on screen, by its section
      const onScreen = {};
      for (const sec of document.querySelectorAll("section[data-screen-label]")) {
        const p = sec.querySelector("[data-copy-panel], h1"); if (!p) continue;
        const r = p.getBoundingClientRect();
        if (r.bottom > 0 && r.top < innerHeight) onScreen[sec.id] = measure(p);
      }
      const own = measure(s.querySelector("[data-copy-panel], h1"));
      return { stop: s.id, at: ${sp}, ...own, panels: onScreen, silhouette, rects };
    })()`);
    result.push(r);
    console.log(r.stop, "panel", JSON.stringify(r.panel), "text", JSON.stringify(r.text));
  }
  writeFileSync(out, JSON.stringify({ viewport: [W, H], stops: result }, null, 1));
} finally { ws.close(); proc.kill(); }
