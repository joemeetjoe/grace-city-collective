/**
 * The pure half of the transfer measurement (tools/perf/transfer.mjs): what a
 * response counts as, how a page load's responses add up per category by two
 * moments (the intro gate opening, the network going idle), and the table
 * that prints.
 */

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
