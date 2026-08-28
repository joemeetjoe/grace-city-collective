// Authors "Collective" upright on a grid, then shears it to a roundhand slant.
import { writeFileSync } from "node:fs";

const B = 250;      // baseline
const X = 180;      // x-height line (70 = 0.35 * 200 ascender)
const K = 0.5;     // slant shear (x += K * (B - y))
const STROKE = 8;

let cur = [0, 0];
let lastCp = [0, 0];
const segs = [];   // [type, pts...] in upright space
const marks = [];  // extra subpaths

function M(x, y) { cur = [x, y]; lastCp = [x, y]; segs.push(["M", [x, y]]); }
/** cubic with explicit control points */
function C(c1, c2, e) { segs.push(["C", c1, c2, e]); cur = e; lastCp = c2; }
/** cubic whose first control point continues the previous tangent by `len` units */
function S(len, c2, e) {
  const dx = cur[0] - lastCp[0], dy = cur[1] - lastCp[1];
  const n = Math.hypot(dx, dy) || 1;
  const c1 = [cur[0] + (dx / n) * len, cur[1] + (dy / n) * len];
  C(c1, c2, e);
}
/** draws the last `n` cubics again in reverse, so the pen doubles back over its own line */
function retrace(n) {
  const tail = segs.slice(-n);
  const starts = tail.map((_, i) => segs[segs.length - n + i - 1].at(-1));
  for (let i = n - 1; i >= 0; i--) C(tail[i][2], tail[i][1], starts[i]);
}

// ---- C ----
M(132, 118);
C([130, 92], [108, 74], [82, 74]);
S(30, [24, 118], [24, 165]);
S(50, [58, 250], [98, 250]);
S(20, [138, 242], [152, 232]);

// ---- o ----  center (198,215) rx 28 ry 35
S(18, [226, 242], [226, 215]);
S(19, [213, 180], [198, 180]);
C([183, 180], [170, 196], [170, 215]);
C([170, 234], [183, 250], [198, 250]);
C([213, 250], [226, 234], [226, 215]);
S(12, [232, 186], [244, 186]);   // exit at x-height, heading right

// ---- l l ----
function ell(bx, startsHigh) {
  // upstroke (bowed right) to the loop apex
  S(startsHigh ? 20 : 30, [bx + 22, 100], [bx + 24, 76]);
  S(14, [bx + 6, 54], [bx + 2, 78]);
  S(30, [bx, 210], [bx, 238]);
  S(8, [bx + 8, 253], [bx + 16, 246]);
}
ell(266, true);
S(14, [326 - 19, 198], [326 - 14, 182]);
ell(340, false);

// ---- e ----
function e(bx, dip = 226) {
  S(16, [bx - 6, dip], [bx + 8, 204]);      // upstroke through the crossing (shallower after a top join)
  S(8, [bx + 9, 180], [bx, 179]);            // over the top of the eye
  S(6, [bx - 12, 192], [bx - 10, 234]);      // down the left, crossing the upstroke
  S(6, [bx + 4, 254], [bx + 20, 244]);       // along the bottom, exit up-right
}
e(400);

// ---- c ----
// A monoline c closes into an e if the entry hairline runs inside it, so the
// entry is instead drawn up the c's own back: over the top hook to a free
// terminal, then retraced down the back before rounding the bottom hook.
function c(bx) {
  S(10, [bx - 16, 232], [bx - 15, 216]);          // bend up-left, joining the back at mid height
  C([bx - 15, 198], [bx - 8, 180], [bx + 2, 180]); // up the back and over the top
  C([bx + 11, 180], [bx + 18, 184], [bx + 19, 193]); // hook down to the open terminal
  retrace(2);                                       // back over the top and down the back
  S(12, [bx - 12, 250], [bx + 2, 250]);            // round the bottom
  S(6, [bx + 12, 249], [bx + 16, 240]);            // exit
}
c(462);

// ---- t ----
function t(bx) {
  S(20, [bx - 4, 212], [bx + 1, 190]);
  S(20, [bx + 5, 140], [bx + 5, 128]);
  S(5, [bx + 1, 122], [bx + 1, 130]);
  S(36, [bx, 220], [bx, 238]);
  S(8, [bx + 8, 253], [bx + 16, 246]);
  marks.push([["M", [bx - 6, 174]], ["C", [bx + 4, 170], [bx + 16, 170], [bx + 26, 172]]]);
}
t(497);

// ---- i ----
function i(bx) {
  S(20, [bx - 8, 210], [bx, 182]);
  C([bx, 200], [bx, 230], [bx, 238]);
  S(8, [bx + 8, 253], [bx + 16, 246]);
  marks.push([["M", [bx, 148]], ["C", [bx, 149], [bx, 151], [bx, 152]]]);
}
i(541);

// ---- v ----
function v(bx) {
  S(20, [bx - 22, 200], [bx - 18, 186]);
  S(6, [bx - 10, 180], [bx - 6, 188]);
  S(20, [bx, 235], [bx + 4, 243]);
  S(8, [bx + 16, 246], [bx + 22, 230]);
  S(14, [bx + 28, 198], [bx + 28, 190]);
  S(6, [bx + 30, 180], [bx + 40, 184]);   // open shoulder instead of a loop; exits right at x-height
}
v(587);

// ---- e + flourish ----
e(655, 216);
S(50, [655 + 110, 190], [655 + 150, 200]);
S(60, [655 + 225, 230], [655 + 258, 227]);

// ---- shear + emit ----
const sh = ([x, y]) => [x + K * (B - y), y];
const fmt = (n) => (Math.round(n * 10) / 10).toString();
let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
const all = [segs, ...marks];
for (const sp of all) for (const s of sp) for (const p of s.slice(1)) {
  const [x, y] = sh(p);
  minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
}
const pad = STROKE;
const ox = pad - minX, oy = pad - minY;
const emit = (sp) => sp.map((s) => s[0] + " " + s.slice(1).map((p) => { const [x, y] = sh(p); return fmt(x + ox) + " " + fmt(y + oy); }).join(" ")).join(" ");
const d = all.map(emit).join(" ");
const W = Math.ceil(maxX + ox + pad), H = Math.ceil(maxY + oy + pad), BASE = Math.round((B + oy) * 10) / 10;
console.log(JSON.stringify({ W, H, baseline: BASE, stroke: STROKE, len: d.length }));

const P = (h) => `<svg viewBox="0 0 ${W} ${H}" height="${h}" preserveAspectRatio="xMinYMid meet"><path d="${d}" fill="none" stroke="currentColor" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const html = `<!doctype html><meta charset=utf-8><style>
body{margin:0;background:#14100e;color:#f9f4ed;font-family:sans-serif}
.row{display:flex;align-items:center;gap:40px;padding:16px 40px}
svg{overflow:visible}
</style>
<div class=row>${P(120)}</div>
<div class=row>${P(28)}${P(60)}</div>
<div class=row><svg viewBox="0 0 ${W} ${H}" height="280"><g stroke="#5a4a40" stroke-width="1"><line x1="0" x2="${W}" y1="${B + oy}" y2="${B + oy}"/><line x1="0" x2="${W}" y1="${X + oy}" y2="${X + oy}" stroke-dasharray="4 4"/><line x1="0" x2="${W}" y1="${60 + oy}" y2="${60 + oy}" stroke-dasharray="4 4"/></g><path d="${d}" fill="none" stroke="currentColor" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`;
writeFileSync("collective.html", html);
const zoom = (vb) => `<svg viewBox="${vb}" height="560" preserveAspectRatio="xMidYMid meet"><g stroke="#5a4a40" stroke-width="0.5"><line x1="0" x2="${W}" y1="${B + oy}" y2="${B + oy}"/><line x1="0" x2="${W}" y1="${X + oy}" y2="${X + oy}" stroke-dasharray="4 4"/></g><path d="${d}" fill="none" stroke="currentColor" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
writeFileSync("final.html", `<!doctype html><meta charset=utf-8><style>body{margin:0;background:#14100e;color:#f9f4ed}.row{display:flex;align-items:center;padding:24px 40px}</style><div class=row>${P(120)}</div><div class=row style="padding-top:0">${P(28)}</div>`);
writeFileSync("zoom.html", `<!doctype html><meta charset=utf-8><style>body{margin:0;background:#14100e;color:#f9f4ed}.row{display:flex;gap:20px;padding:20px}</style><div class=row>${zoom(process.env.ZOOM || "440 150 260 120")}</div>`);
writeFileSync("collective.d.txt", d);
writeFileSync("collective.meta.json", JSON.stringify({ W, H, BASE, STROKE }));
