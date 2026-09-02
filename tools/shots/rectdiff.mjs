#!/usr/bin/env node
/**
 * The line boxes two cdp-shot runs recorded (--rects), compared: for each
 * label in both state.json files, the number of lines and the largest
 * shift of any line edge, in CSS px, vertical and horizontal apart. Exit 1
 * when a label's line count differs or an edge moved more than its
 * tolerance (#106: the fonts-blocked hero against the normal one; the
 * tolerances and why they differ are in tools/README.md).
 *
 * Usage:
 *   node tools/shots/rectdiff.mjs a/state.json b/state.json [--y 0.5] [--x 16]
 */
import { readFileSync } from "node:fs";

const [a, b] = process.argv.slice(2).filter((s) => !s.startsWith("--"));
const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > -1 ? Number(process.argv[i + 1]) : d;
};
const toleranceY = arg("y", 0.5);
const toleranceX = arg("x", 16);
if (!a || !b) {
  console.error("usage: rectdiff.mjs a/state.json b/state.json [--y px] [--x px]");
  process.exit(2);
}
const read = (p) => Object.fromEntries(JSON.parse(readFileSync(p, "utf8")).filter((s) => s.lines).map((s) => [s.label, s]));
const A = read(a), B = read(b);
let failed = false;
for (const label of Object.keys(A)) {
  if (!B[label]) continue;
  const la = A[label].lines, lb = B[label].lines;
  if (la.length !== lb.length) {
    console.log(`${label}: ${la.length} lines vs ${lb.length}`);
    failed = true;
    continue;
  }
  let maxX = 0;
  let maxY = 0;
  const deltas = la.map((m, i) => {
    const n = lb[i];
    const d = { x0: n.x0 - m.x0, y0: n.y0 - m.y0, x1: n.x1 - m.x1, y1: n.y1 - m.y1 };
    maxX = Math.max(maxX, Math.abs(d.x0), Math.abs(d.x1));
    maxY = Math.max(maxY, Math.abs(d.y0), Math.abs(d.y1));
    return d;
  });
  const fmt = (v) => (v >= 0 ? "+" : "") + v.toFixed(2);
  const size = (l) => `${(l.x1 - l.x0).toFixed(2)}×${(l.y1 - l.y0).toFixed(2)}`;
  console.log(
    `${label}: ${la.length} lines, max shift y ${maxY.toFixed(2)}px (tolerance ${toleranceY}), x ${maxX.toFixed(2)}px (tolerance ${toleranceX})`,
  );
  deltas.forEach((d, i) =>
    console.log(`  line ${i + 1}: x0 ${fmt(d.x0)}  y0 ${fmt(d.y0)}  x1 ${fmt(d.x1)}  y1 ${fmt(d.y1)}   (${size(la[i])} → ${size(lb[i])})`),
  );
  if (A[label].fontsLoaded || B[label].fontsLoaded) console.log(`  fonts: [${A[label].fontsLoaded}] vs [${B[label].fontsLoaded}]`);
  if (maxX > toleranceX || maxY > toleranceY) failed = true;
}
process.exit(failed ? 1 : 0);
