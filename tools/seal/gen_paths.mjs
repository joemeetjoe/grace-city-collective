// Generates src/components/sealPaths.ts — the vector artwork of the wax seal.
// Run: node tools/seal/gen_paths.mjs
//
// Everything lives in a 100×100 user space with the disc centred at (50,50).
// Petals are drawn as a centreline (Catmull-Rom through a few hand-placed
// points) swept with a width profile, so the outlines stay smooth while the
// shape is tuned by nudging a handful of numbers.

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { FLEUR_CC0, FLEUR_CC0_BOX } from "./fleur_cc0.mjs";

const f = (n) => (Math.round(n * 10) / 10).toString();

/** Catmull-Rom spline through pts → cubic Bézier path (open or closed). */
function catmullRom(pts, closed) {
  const n = pts.length;
  const at = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  const segs = closed ? n : n - 1;
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < segs; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f(c1[0])},${f(c1[1])} ${f(c2[0])},${f(c2[1])} ${f(p2[0])},${f(p2[1])}`;
  }
  return closed ? `${d}Z` : d;
}

/** Sample a Catmull-Rom centreline densely: returns [{p, t}] with t = normalised arc length. */
function sampleCentreline(pts, steps = 240) {
  const n = pts.length;
  const at = (i) => pts[Math.max(0, Math.min(n - 1, i))];
  const out = [];
  for (let s = 0; s <= steps; s++) {
    const u = (s / steps) * (n - 1);
    const i = Math.min(n - 2, Math.floor(u));
    const t = u - i;
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const q = (k) =>
      0.5 *
      (2 * p1[k] +
        (-p0[k] + p2[k]) * t +
        (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t * t +
        (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t * t * t);
    out.push([q(0), q(1)]);
  }
  let len = 0;
  const cum = [0];
  for (let i = 1; i < out.length; i++) {
    len += Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1]);
    cum.push(len);
  }
  return out.map((p, i) => ({ p, t: cum[i] / len }));
}

/** Piecewise-linear width profile: [[t, width], …]. */
const profile = (stops) => (t) => {
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [t0, w0] = stops[i - 1];
      const [t1, w1] = stops[i];
      return w0 + ((t - t0) / (t1 - t0)) * (w1 - w0);
    }
  }
  return stops[stops.length - 1][1];
};

/**
 * Sweep a width profile along a centreline → closed outline through ~`n`
 * points per side, smoothed with Catmull-Rom. The end at t=1 is capped with a
 * short arc so tips stay round rather than sheared.
 */
function sweep(centre, widthAt, n = 14) {
  const samples = sampleCentreline(centre);
  const pick = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    let best = samples[0];
    for (const s of samples) if (Math.abs(s.t - t) < Math.abs(best.t - t)) best = s;
    pick.push(best);
  }
  const normal = (s) => {
    const i = samples.indexOf(s);
    const a = samples[Math.max(0, i - 2)].p;
    const b = samples[Math.min(samples.length - 1, i + 2)].p;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    return [-dy / l, dx / l, dx / l, dy / l];
  };
  const left = [];
  const right = [];
  for (const s of pick) {
    const [nx, ny] = normal(s);
    const w = widthAt(s.t) / 2;
    left.push([s.p[0] + nx * w, s.p[1] + ny * w]);
    right.push([s.p[0] - nx * w, s.p[1] - ny * w]);
  }
  // round cap at the tip
  const tip = pick[pick.length - 1];
  const [nx, ny, tx, ty] = normal(tip);
  const w = widthAt(1) / 2;
  const cap = [];
  for (let a = 1; a < 4; a++) {
    const th = (a / 4) * Math.PI;
    cap.push([tip.p[0] + nx * w * Math.cos(th) + tx * w * Math.sin(th), tip.p[1] + ny * w * Math.cos(th) + ty * w * Math.sin(th)]);
  }
  return catmullRom([...left, ...cap, ...right.reverse()], true);
}

const mirrorPath = (d) => d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${f(100 - Number(x))},${y}`);

// ---------------------------------------------------------------------------
// The wax disc. Real wax settles into a soft, slightly uneven puddle: a few
// broad, gentle lobes and no sharp features, so the edge reads as poured, not
// cut. Sampled densely so the Catmull-Rom stays smooth everywhere.
const puddle = (base, amp, N) => {
  const pts = [];
  for (let i = 0; i < N; i++) {
    const th = (i / N) * Math.PI * 2;
    const r =
      base +
      amp * (0.9 * Math.sin(2 * th + 0.6) + 0.7 * Math.sin(3 * th + 2.4) + 0.35 * Math.sin(5 * th + 1.1) + 0.15 * Math.sin(7 * th + 4.0));
    pts.push([50 + r * Math.cos(th), 50 + r * Math.sin(th)]);
  }
  return catmullRom(pts, true);
};
const wax = puddle(45.2, 1.6, 64);

// The pressed field: the die's face, a true circle sunk into the wax.
const field = (() => {
  const pts = [];
  const N = 48;
  for (let i = 0; i < N; i++) {
    const th = (i / N) * Math.PI * 2;
    const r = 36.5;
    pts.push([50 + r * Math.cos(th), 50 + r * Math.sin(th)]);
  }
  return catmullRom(pts, true);
})();

// ---------------------------------------------------------------------------
// Fleur-de-lis: the classic heraldic form (see fleur_cc0.mjs), scaled so it
// stands FLEUR_HEIGHT tall and centred on the field.
const FLEUR_HEIGHT = 54;
const FLEUR_CENTRE = [50, 51.5];
const lis = (() => {
  const s = FLEUR_HEIGHT / FLEUR_CC0_BOX.height;
  const cx = FLEUR_CC0_BOX.x + FLEUR_CC0_BOX.width / 2;
  const cy = FLEUR_CC0_BOX.y + FLEUR_CC0_BOX.height / 2;
  return FLEUR_CC0.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_, x, y) =>
    `${f(FLEUR_CENTRE[0] + (Number(x) - cx) * s)},${f(FLEUR_CENTRE[1] + (Number(y) - cy) * s)}`,
  ).replace(/\s+/g, " ").trim();
})();

// The band: its own shape, laid over the fleur's own tie and a touch heavier,
// with softly flared ends — so it can be read as the Trinity's binding.
const BAND_Y = 51.5 + FLEUR_HEIGHT * 0.128; // the tie sits just below the fleur's centre
const band = (() => {
  const h = 4.6;
  const w = 12.6;
  const flare = 0.9;
  const y0 = BAND_Y - h / 2;
  const y1 = BAND_Y + h / 2;
  return [
    `M${f(50 - w)},${f(y0 - flare)}`,
    `C${f(50 - w * 0.55)},${f(y0 + 0.5)} ${f(50 + w * 0.55)},${f(y0 + 0.5)} ${f(50 + w)},${f(y0 - flare)}`,
    `C${f(50 + w + 0.9)},${f(BAND_Y)} ${f(50 + w + 0.9)},${f(BAND_Y)} ${f(50 + w)},${f(y1 + flare)}`,
    `C${f(50 + w * 0.55)},${f(y1 - 0.5)} ${f(50 - w * 0.55)},${f(y1 - 0.5)} ${f(50 - w)},${f(y1 + flare)}`,
    `C${f(50 - w - 0.9)},${f(BAND_Y)} ${f(50 - w - 0.9)},${f(BAND_Y)} ${f(50 - w)},${f(y0 - flare)}Z`,
  ].join("");
})();

// ---------------------------------------------------------------------------
// The pour: a bead of wax with a tapering tail, drawn in place over the disc so
// the intro can drop it from above and morph it into the disc outline.
const drip = catmullRom(
  [
    [50, 9],
    [53.5, 22],
    [58.5, 36],
    [63.5, 50],
    [64, 62],
    [59.5, 72],
    [50, 76],
    [40.5, 72],
    [36, 62],
    [36.5, 50],
    [41.5, 36],
    [46.5, 22],
  ],
  true,
);

const out = `// GENERATED by tools/seal/gen_paths.mjs — edit that file, not this one.
// Vector artwork for the wax seal, in a 100×100 user space centred at (50,50).

/** irregular outline of the wax disc */
export const WAX = "${wax}";
/** pressed field inside the raised rim */
export const FIELD = "${field}";
/** fleur-de-lis pieces, excluding the band */
export const FLEUR = {
  lis: "${lis}",
} as const;
/** the horizontal band across the fleur-de-lis */
export const BAND = "${band}";
/** a bead of wax with a tail, in place over the disc; the intro drops it in and pools it into WAX */
export const DRIP = "${drip}";
`;

const here = dirname(fileURLToPath(import.meta.url));
const target = join(here, "..", "..", "src", "components", "sealPaths.ts");
writeFileSync(target, out);
console.log(`wrote ${target} (${out.length} bytes)`);
