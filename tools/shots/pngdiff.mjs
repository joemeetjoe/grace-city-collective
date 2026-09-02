#!/usr/bin/env node
// pngdiff.mjs a.png b.png [tolerance] [--max pct] — pure-node PNG pixel diff.
// Prints: size, % pixels with any channel delta > tolerance (default 8), max delta.
// Exits 1 when that share is over --max (default 0.5 %, the shot gate's
// threshold; tools/README.md says when a wider one is used).
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

function decode(path) {
  const buf = readFileSync(path);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error(`${path}: not a PNG`);
  let pos = 8, w = 0, h = 0, bitDepth = 0, colorType = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9];
      if (bitDepth !== 8) throw new Error(`${path}: bit depth ${bitDepth} unsupported`);
      if (data[12] !== 0) throw new Error(`${path}: interlaced unsupported`);
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  const raw = inflateSync(Buffer.concat(idat));
  const bpp = channels;
  const stride = w * bpp;
  const out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= bpp ? prev[x - bpp] : 0;
      let v = row[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[x] = v & 0xff;
    }
  }
  return { w, h, channels, data: out };
}

const argv = process.argv.slice(2);
const maxAt = argv.indexOf("--max");
const maxPct = maxAt > -1 ? Number(argv[maxAt + 1]) : 0.5;
if (maxAt > -1) argv.splice(maxAt, 2);
const [a, b, tolArg] = argv;
const tol = Number(tolArg ?? 8);
const A = decode(a), B = decode(b);
if (A.w !== B.w || A.h !== B.h || A.channels !== B.channels) {
  console.log(`SIZE MISMATCH ${A.w}x${A.h}c${A.channels} vs ${B.w}x${B.h}c${B.channels}`);
  process.exit(2);
}
let bad = 0, maxd = 0;
const n = A.w * A.h, ch = A.channels;
for (let i = 0; i < n; i++) {
  let d = 0;
  for (let k = 0; k < ch; k++) d = Math.max(d, Math.abs(A.data[i * ch + k] - B.data[i * ch + k]));
  if (d > tol) bad++;
  if (d > maxd) maxd = d;
}
const pct = (100 * bad) / n;
console.log(`${(pct).toFixed(4)}% pixels > ${tol}, max delta ${maxd} (${A.w}x${A.h})`);
process.exit(pct > maxPct ? 1 : 0);
