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
// The wax disc: a hand-cut edge — a few low-frequency lobes, a little jitter,
// and one heavier squeeze-out bulge at the lower left where the wax was thumbed.
const wax = (() => {
  const pts = [];
  const N = 40;
  for (let i = 0; i < N; i++) {
    const th = (i / N) * Math.PI * 2;
    let r =
      44.6 +
      1.1 * Math.sin(3 * th + 0.4) +
      0.7 * Math.sin(5 * th + 2.1) +
      0.45 * Math.sin(8 * th + 1.0) +
      0.3 * Math.sin(13 * th + 3.3);
    const bulge = Math.exp(-((th - 2.35) ** 2) / 0.09); // lower-left thumb
    r += 2.4 * bulge;
    const nick = Math.exp(-((th - 5.4) ** 2) / 0.02); // small nick top-right
    r -= 1.2 * nick;
    const lip = Math.exp(-((th - 0.35) ** 2) / 0.06); // softer lip on the right
    r += 1.3 * lip;
    pts.push([50 + r * Math.cos(th), 50 + r * Math.sin(th)]);
  }
  return catmullRom(pts, true);
})();

// The pressed field inside the raised rim (a slightly irregular near-circle).
const field = (() => {
  const pts = [];
  const N = 28;
  for (let i = 0; i < N; i++) {
    const th = (i / N) * Math.PI * 2;
    const r = 38.2 + 0.5 * Math.sin(4 * th + 1.2) + 0.3 * Math.sin(7 * th);
    pts.push([50 + r * Math.cos(th), 50 + r * Math.sin(th)]);
  }
  return catmullRom(pts, true);
})();

// ---------------------------------------------------------------------------
// Fleur-de-lis. Band centre y≈57; overall extent y 17 → 82.

// Centre petal: a spear — concave flanks near the point, widest two-thirds down.
const centre = [
  "M50,16.5",
  "C50.6,23.5 53.8,31 56.4,39.5",
  "C58.4,46 57.6,50.5 56.2,54",
  "L43.8,54",
  "C42.4,50.5 41.6,46 43.6,39.5",
  "C46.2,31 49.4,23.5 50,16.5Z",
].join("");

// Outer petal (left): rises beside the centre, arches out and over, then
// curls down to a tip that turns back in toward the band.
const petalL = sweep(
  [
    [42.6, 57],
    [42, 50],
    [40, 43.5],
    [36.4, 37],
    [31, 32.4],
    [25.4, 31.6],
    [21, 34.6],
    [19.4, 39.8],
    [20.4, 45.6],
    [23.4, 50.6],
  ],
  profile([
    [0, 7],
    [0.2, 7.8],
    [0.42, 8.6],
    [0.64, 6.4],
    [0.84, 3.8],
    [1, 2.2],
  ]),
);
const petalR = mirrorPath(petalL);

// The band: a solid bar, a shade heavier than any petal, with flared ends.
const band = [
  "M32.6,53.2",
  "C33.6,53.6 66.4,53.6 67.4,53.2",
  "C68.6,56 68.6,58.4 67.4,61.4",
  "C66.4,61 33.6,61 32.6,61.4",
  "C31.4,58.4 31.4,56 32.6,53.2Z",
].join("");

// Feet: a slender centre point and two small curls that mirror the petals.
const footC = [
  "M50,82.5",
  "C52.8,76 54.9,68.5 54.4,60.5",
  "L45.6,60.5",
  "C45.1,68.5 47.2,76 50,82.5Z",
].join("");

const footL = sweep(
  [
    [42.4, 58],
    [40.8, 63.4],
    [37.6, 68.4],
    [32.6, 71.4],
    [27.6, 70.6],
    [24.6, 67],
    [24.8, 62.8],
  ],
  profile([
    [0, 6],
    [0.3, 6.4],
    [0.6, 4.6],
    [0.85, 2.6],
    [1, 1.3],
  ]),
);
const footR = mirrorPath(footL);

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
  centre: "${centre}",
  petalL: "${petalL}",
  petalR: "${petalR}",
  footC: "${footC}",
  footL: "${footL}",
  footR: "${footR}",
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
