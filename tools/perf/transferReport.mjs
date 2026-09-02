/**
 * The pure half of the transfer measurement (tools/perf/transfer.mjs): what a
 * response counts as, how a page load's responses add up per category by two
 * moments (the intro gate opening, the network going idle), and the table
 * that prints.
 */

/**
 * The two viewports the transfer measures, one per tier: desktop 1600×900 at
 * DPR 2, mobile 390×844 at DPR 1.5 with the mobile flag, so tierFor() picks
 * the 2048 and 1024 tiers respectively. The budget's poster row
 * (budgetReport.mjs) takes the poster rung these would pick.
 */
export const PROFILES = {
  desktop: { width: 1600, height: 900, dpr: 2, mobile: false },
  mobile: { width: 390, height: 844, dpr: 1.5, mobile: true },
};

/** the categories a first load is made of, in table order */
export const CATEGORIES = ["html", "js", "css", "font", "texture", "other"];

const EXT = {
  js: "js", mjs: "js",
  css: "css",
  woff: "font", woff2: "font", ttf: "font", otf: "font",
  webp: "texture", avif: "texture", png: "texture", jpg: "texture", jpeg: "texture",
};

/** which category a response belongs to, from its url's extension and then its mime type */
export function classify(url, mimeType = "") {
  const path = new URL(url, "http://x").pathname;
  const ext = path.includes(".") ? path.slice(path.lastIndexOf(".") + 1).toLowerCase() : "";
  if (ext === "svg" || ext === "ico") return "other";
  if (ext === "json") return "texture";
  if (EXT[ext]) return EXT[ext];
  const mime = mimeType.split(";")[0].trim();
  if (mime === "text/html" || ext === "html" || ext === "") return "html";
  if (mime.startsWith("image/")) return "texture";
  if (mime.startsWith("font/")) return "font";
  if (mime.includes("javascript")) return "js";
  if (mime === "text/css") return "css";
  return "other";
}

function tally(responses) {
  const by = Object.fromEntries(CATEGORIES.map((c) => [c, { bytes: 0, count: 0 }]));
  let total = 0;
  for (const res of responses) {
    const cat = classify(res.url, res.mimeType);
    by[cat].bytes += res.bytes;
    by[cat].count += 1;
    total += res.bytes;
  }
  return { ...by, total };
}

/**
 * One page load's responses, added up per category to two moments: the
 * intro gate opening — in network terms, the tier's last texture landing —
 * and the network going idle (every response). No textures, no gate: a
 * warm load served from cache still lists its hits, at zero bytes.
 */
export function summarise(responses) {
  const textures = responses.filter((r) => classify(r.url, r.mimeType) === "texture");
  const gateAt = textures.length ? Math.max(...textures.map((r) => r.finishedAt)) : null;
  return {
    gateAt,
    toGate: gateAt === null ? null : tally(responses.filter((r) => r.finishedAt <= gateAt)),
    toIdle: tally(responses),
    cached: responses.filter((r) => r.fromCache).length,
  };
}

/** bytes as kilobytes with one decimal */
export function kb(bytes) {
  return (bytes / 1024).toFixed(1);
}

const pad = (s, n) => String(s).padStart(n);

/**
 * The per-tier table: a row per category, the bytes on the wire by the gate
 * opening, by idle, and on a warm second load (idle).
 */
export function formatTable(tiers) {
  const lines = [];
  for (const [name, { cold, warm }] of Object.entries(tiers)) {
    lines.push(`${name}  (kB on the wire)`);
    lines.push(`  ${pad("", 8)} ${pad("gate", 9)} ${pad("idle", 9)} ${pad("warm", 9)}`);
    for (const cat of [...CATEGORIES, "total"]) {
      const at = (s) => (s ? (cat === "total" ? s.total : s[cat].bytes) : 0);
      lines.push(
        `  ${pad(cat, 8)} ${pad(kb(at(cold.toGate)), 9)} ${pad(kb(at(cold.toIdle)), 9)} ${pad(kb(warm ? at(warm.toIdle) : 0), 9)}`,
      );
    }
    const files = (s) => (s ? Object.values(s).reduce((n, v) => n + (v.count ?? 0), 0) : 0);
    lines.push(`  ${pad("files", 8)} ${pad(files(cold.toGate), 9)} ${pad(files(cold.toIdle), 9)} ${pad(warm ? files(warm.toIdle) : 0, 9)}`);
    lines.push("");
  }
  return lines.join("\n");
}

/**
 * The load as a timeline: every response in finishing order — start, end
 * (ms from the first request), kB, path — with the page's own marks
 * (e.g. trace: the splash's G-mark trace began; gate) slotted in by time.
 */
export function formatTimeline(responses, marks = {}) {
  const rows = [
    ...responses.map((r) => ({ at: r.finishedAt, line: `${pad(r.startedAt ?? "", 6)} ${pad(r.finishedAt, 6)} ${pad(kb(r.bytes), 8)}  ${new URL(r.url, "http://x").pathname}` })),
    ...Object.entries(marks)
      .filter(([, at]) => at != null)
      .map(([name, at]) => ({ at, mark: true, line: `${pad("", 6)} ${pad(at, 6)} ${pad("", 8)}  -- ${name}` })),
  ];
  // a mark sits after the responses that finished by the same moment
  rows.sort((a, b) => a.at - b.at || (a.mark ? 1 : 0) - (b.mark ? 1 : 0));
  return rows.map((r) => r.line).join("\n");
}

/** a poster rung's file name (src/assets/poster/, hashed by Vite in dist/): the width and format */
const POSTER_FILE = /dore-pentecost-dark-(\d+)(?:-[^/.]+)?\.(avif|webp)$/;

/**
 * The still poster requests in a load (the fallback path: no WebGL, reduced
 * motion, Save-Data), each with the rung width and format the browser
 * picked from the ladder and its bytes; empty on the scene path.
 */
export function posterResponses(responses) {
  const list = [];
  for (const res of responses) {
    const path = new URL(res.url, "http://x").pathname;
    const m = POSTER_FILE.exec(path);
    if (m) list.push({ path, rung: Number(m[1]), format: m[2], bytes: res.bytes });
  }
  return list;
}
