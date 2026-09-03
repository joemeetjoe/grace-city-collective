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
 * opening, by idle, then — for a run that scrolled on after idle
 * (`--scroll-to`, #111) — what that scroll fetched, and on a warm second
 * load (idle).
 */
export function formatTable(tiers) {
  const lines = [];
  const anyLate = Object.values(tiers).some((t) => t.late);
  for (const [name, { cold, warm, late }] of Object.entries(tiers)) {
    const columns = (of) => [of(cold.toGate), of(cold.toIdle), ...(anyLate ? [of(late?.toIdle)] : []), of(warm?.toIdle)];
    lines.push(`${name}  (kB on the wire)`);
    lines.push(`  ${pad("", 8)} ${["gate", "idle", ...(anyLate ? ["late"] : []), "warm"].map((h) => pad(h, 9)).join(" ")}`);
    for (const cat of [...CATEGORIES, "total"]) {
      const at = (s) => (s ? (cat === "total" ? s.total : s[cat].bytes) : 0);
      lines.push(`  ${pad(cat, 8)} ${columns((s) => pad(kb(at(s)), 9)).join(" ")}`);
    }
    const files = (s) => (s ? Object.values(s).reduce((n, v) => n + (v.count ?? 0), 0) : 0);
    lines.push(`  ${pad("files", 8)} ${columns((s) => pad(files(s), 9)).join(" ")}`);
    lines.push("");
  }
  return lines.join("\n");
}

/**
 * The expression that scrolls the page to `#id` at once, through the
 * smoother's instant scroll on the page's seam (`window.__gcc.scrollTo`,
 * src/state/seam.ts) when one is running — the same way the shots reach a
 * stop, tools/shots/cdp-shot.mjs — and reports the page's own clock at that
 * moment: the mark the late phase (#111) starts from.
 */
export function scrollToScript(id) {
  return `(() => {
    const s = document.getElementById(${JSON.stringify(id)});
    if (!s) throw new Error("no element #" + ${JSON.stringify(id)});
    const top = s.getBoundingClientRect().top + window.scrollY;
    if (window.__gcc?.scrollTo) window.__gcc.scrollTo(top); else window.scrollTo({ top, behavior: "instant" });
    return Math.round(performance.now());
  })()`;
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

/** a tier texture's source in the Vite manifest: `src/assets/dore/<width>/<file>` */
const TIER_SOURCE = /^src\/assets\/dore\/(\d+)\/[^/]+\.(webp|avif)$/;

/**
 * Which plate widths a load's textures came from, read back through the
 * Vite manifest (dist/.vite/manifest.json maps each source to its hashed
 * file): `["2048"]` on a desktop load that stayed within its tier, two
 * widths where something fetched across. A texture the manifest does not
 * know is listed under "?".
 */
export function textureTiers(responses, manifest) {
  const widthOf = new Map();
  for (const [src, entry] of Object.entries(manifest)) {
    const m = TIER_SOURCE.exec(src);
    if (m) widthOf.set(`/${entry.file}`, m[1]);
  }
  const widths = new Set();
  for (const res of responses) {
    const path = new URL(res.url, "http://x").pathname;
    if (!/\.(webp|avif)$/.test(path) || /dore-pentecost-dark-/.test(path)) continue;
    widths.add(widthOf.get(path) ?? "?");
  }
  return [...widths].sort();
}

/**
 * When the first texture request went out against the shell chunk landing:
 * `{ firstTextureAt, shellDoneAt, beforeShell }` in ms from the first
 * request, with nulls where a load had no texture or no shell. The head
 * script's preloads (#113) put the first texture on the wire while the
 * shell is still downloading; the bundle's own injector could only ask
 * once the shell had run.
 */
export function textureStartVsShell(responses, shellFile) {
  const textures = responses.filter((r) => classify(r.url, r.mimeType) === "texture" && r.startedAt != null);
  const shell = responses.find((r) => new URL(r.url, "http://x").pathname === `/${shellFile}`);
  const firstTextureAt = textures.length ? Math.min(...textures.map((r) => r.startedAt)) : null;
  const shellDoneAt = shell?.finishedAt ?? null;
  return {
    firstTextureAt,
    shellDoneAt,
    beforeShell: firstTextureAt !== null && shellDoneAt !== null && firstTextureAt < shellDoneAt,
  };
}
