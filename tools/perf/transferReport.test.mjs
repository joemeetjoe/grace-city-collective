import { describe, expect, it } from "vitest";

import { classify } from "./transferReport.mjs";

describe("classify", () => {
  it("names a response's category from its url and mime type", () => {
    expect(classify("http://localhost/", "text/html")).toBe("html");
    expect(classify("http://localhost/assets/index-BKx3.js", "text/javascript")).toBe("js");
    expect(classify("http://localhost/assets/index-D8yi.css", "text/css")).toBe("css");
    expect(classify("http://localhost/assets/geist-latin-wght-normal-BgDa.woff2", "font/woff2")).toBe("font");
    expect(classify("http://localhost/dore/2048/plate.webp", "image/webp")).toBe("texture");
    expect(classify("http://localhost/dore/2048/cuts.json", "application/json")).toBe("texture");
    expect(classify("http://localhost/favicon.svg", "image/svg+xml")).toBe("other");
  });
});

import { summarise } from "./transferReport.mjs";

const r = (url, bytes, finishedAt, extra = {}) => ({ url, mimeType: "", bytes, finishedAt, ...extra });

describe("summarise", () => {
  it("sums bytes per category up to the gate (the last texture landing) and up to idle", () => {
    const s = summarise([
      r("http://h/", 900, 10),
      r("http://h/assets/index-A.js", 300_000, 200),
      r("http://h/assets/index-A.css", 11_000, 120),
      r("http://h/dore/2048/plate.webp", 378_000, 900),
      r("http://h/dore/2048/map-fig5.webp", 40_000, 1400),
      r("http://h/assets/late-B.js", 5_000, 2000),
    ]);
    expect(s.gateAt).toBe(1400);
    expect(s.toGate.js).toEqual({ bytes: 300_000, count: 1 });
    expect(s.toGate.texture).toEqual({ bytes: 418_000, count: 2 });
    expect(s.toIdle.js).toEqual({ bytes: 305_000, count: 2 });
    expect(s.toGate.total).toBe(900 + 300_000 + 11_000 + 418_000);
    expect(s.toIdle.total).toBe(s.toGate.total + 5_000);
    expect(s.toGate.font).toEqual({ bytes: 0, count: 0 });
  });

  it("has no gate when nothing was a texture, and counts cache hits as zero bytes", () => {
    const s = summarise([r("http://h/", 900, 10), r("http://h/assets/i.js", 0, 50, { fromCache: true })]);
    expect(s.gateAt).toBeNull();
    expect(s.toGate).toBeNull();
    expect(s.toIdle.js).toEqual({ bytes: 0, count: 1 });
    expect(s.cached).toBe(1);
  });
});

import { formatTable, kb } from "./transferReport.mjs";

describe("formatTable", () => {
  it("prints one block per tier with a row per category: gate, idle and warm bytes", () => {
    const cold = summarise([
      r("http://h/", 900, 10),
      r("http://h/assets/index-A.js", 300_000, 200),
      r("http://h/dore/1024/plate.webp", 155_000, 900),
    ]);
    const warm = summarise([r("http://h/", 900, 10), r("http://h/assets/index-A.js", 0, 20, { fromCache: true })]);
    const text = formatTable({ mobile: { cold, warm } });
    expect(text).toContain("mobile");
    expect(text).toMatch(/js\s+293\.0\s+293\.0\s+0\.0/);
    expect(text).toMatch(/texture\s+151\.4\s+151\.4\s+0\.0/);
    expect(text).toMatch(/total\s+445\.2\s+445\.2\s+0\.9/);
    expect(kb(1536)).toBe("1.5");
  });
});

import { formatTimeline } from "./transferReport.mjs";

describe("formatTimeline", () => {
  it("lists each response in finishing order with its start, end and bytes, and the page's marks in between", () => {
    const text = formatTimeline(
      [
        r("http://h/", 900, 40, { startedAt: 0 }),
        r("http://h/assets/index-A.js", 300_000, 900, { startedAt: 45 }),
        r("http://h/assets/PentecostParallax-B.js", 500_000, 1800, { startedAt: 50 }),
      ],
      { trace: 1000, gate: 1800 },
    );
    const lines = text.split("\n");
    expect(lines[0]).toMatch(/^\s+0\s+40\s+0\.9\s+\/$/);
    expect(lines[1]).toMatch(/^\s+45\s+900\s+293\.0\s+\/assets\/index-A\.js$/);
    expect(lines[2]).toMatch(/^\s+1000\s+-- trace$/);
    expect(lines[3]).toMatch(/^\s+50\s+1800\s+488\.3\s+\/assets\/PentecostParallax-B\.js$/);
    expect(lines[4]).toMatch(/^\s+1800\s+-- gate$/);
  });
});

import { posterResponses } from "./transferReport.mjs";

describe("posterResponses", () => {
  it("picks out the poster rungs a load requested, with their width, format and bytes", () => {
    const list = posterResponses([
      r("http://h/", 900, 10),
      r("http://h/assets/index-A.js", 300_000, 200),
      r("http://h/assets/dore-pentecost-dark-2048-Xy12.avif", 310_000, 900),
      r("http://h/assets/dore-pentecost-dark-640-Zz9a.webp", 41_000, 950),
      r("http://h/dore/2048/plate.webp", 378_000, 1200),
    ]);
    expect(list).toEqual([
      { path: "/assets/dore-pentecost-dark-2048-Xy12.avif", rung: 2048, format: "avif", bytes: 310_000 },
      { path: "/assets/dore-pentecost-dark-640-Zz9a.webp", rung: 640, format: "webp", bytes: 41_000 },
    ]);
  });

  it("is empty when the load took the scene path", () => {
    expect(posterResponses([r("http://h/", 900, 10), r("http://h/dore/2048/plate.webp", 378_000, 1200)])).toEqual([]);
  });
});

import { scrollToScript } from "./transferReport.mjs";

describe("scrollToScript", () => {
  it("is the page-side expression that scrolls an id into view, through the smoother when there is one", () => {
    const js = scrollToScript("faq");
    expect(js).toContain('getElementById("faq")');
    expect(js).toContain("__gccScrollTo");
    expect(js).toContain("scrollTo(");
    // quoted as a string literal, so an odd id cannot break out of the script
    expect(scrollToScript('a"b')).toContain(JSON.stringify('a"b'));
  });
});

describe("the late phase", () => {
  const cold = summarise([r("http://h/", 900, 10), r("http://h/assets/index-A.js", 300_000, 200), r("http://h/dore/2048/plate.webp", 378_000, 900)]);
  const warm = summarise([r("http://h/", 900, 10)]);
  const late = { id: "faq", at: 3000, responses: [r("http://h/assets/Longform-B.js", 20_480, 3400, { startedAt: 3010 })], ...summarise([r("http://h/assets/Longform-B.js", 20_480, 3400)]) };

  it("adds a late column to the table when a tier scrolled on after idle, and none otherwise", () => {
    const text = formatTable({ desktop: { cold, warm, late } });
    expect(text).toMatch(/gate\s+idle\s+late\s+warm/);
    expect(text).toMatch(/js\s+293\.0\s+293\.0\s+20\.0\s+0\.0/);
    expect(text).toMatch(/total\s+663\.0\s+663\.0\s+20\.0\s+0\.9/);
    expect(text).toMatch(/files\s+3\s+3\s+1\s+1/);
    expect(formatTable({ desktop: { cold, warm } })).not.toContain("late");
  });

  it("the timeline slots the scroll mark and the late responses after the cold load", () => {
    const text = formatTimeline([...cold.responses ?? [], ...late.responses], { gate: 900, "scroll #faq": late.at });
    const lines = text.split("\n");
    expect(lines.at(-2)).toMatch(/^\s+3000\s+-- scroll #faq$/);
    expect(lines.at(-1)).toMatch(/^\s+3010\s+3400\s+20\.0\s+\/assets\/Longform-B\.js$/);
  });
});

import { textureStartVsShell, textureTiers } from "./transferReport.mjs";

const manifest = {
  "index.html": { file: "assets/index-A.js", isEntry: true },
  "src/assets/dore/2048/map-fig5.avif": { file: "assets/map-fig5-D.avif" },
  "src/assets/dore/2048/masks-cut-0.webp": { file: "assets/masks-cut-0-E.webp" },
  "src/assets/dore/1024/map-fig5.avif": { file: "assets/map-fig5-M.avif" },
  "src/assets/poster/dore-pentecost-dark-640.avif": { file: "assets/dore-pentecost-dark-640-P.avif" },
};

describe("textureTiers", () => {
  it("names the plate widths a load's textures came from, through the manifest, posters aside", () => {
    expect(textureTiers([r("http://h/assets/map-fig5-D.avif", 1, 10), r("http://h/assets/masks-cut-0-E.webp", 1, 20)], manifest)).toEqual(["2048"]);
    expect(textureTiers([r("http://h/assets/map-fig5-D.avif", 1, 10), r("http://h/assets/map-fig5-M.avif", 1, 20)], manifest)).toEqual(["1024", "2048"]);
    expect(textureTiers([r("http://h/assets/dore-pentecost-dark-640-P.avif", 1, 10), r("http://h/assets/index-A.js", 1, 5)], manifest)).toEqual([]);
    expect(textureTiers([r("http://h/assets/stray-Z.webp", 1, 10)], manifest)).toEqual(["?"]);
  });
});

describe("textureStartVsShell", () => {
  it("compares the first texture request's start with the shell chunk landing", () => {
    const early = textureStartVsShell(
      [
        r("http://h/", 900, 40, { startedAt: 0 }),
        r("http://h/assets/index-A.js", 300_000, 900, { startedAt: 45 }),
        r("http://h/assets/plate-backdrop-B.avif", 200_000, 700, { startedAt: 60 }),
        r("http://h/assets/map-fig5-D.avif", 40_000, 1400, { startedAt: 950 }),
      ],
      "assets/index-A.js",
    );
    expect(early).toEqual({ firstTextureAt: 60, shellDoneAt: 900, beforeShell: true });
    const late = textureStartVsShell(
      [r("http://h/assets/index-A.js", 300_000, 900, { startedAt: 45 }), r("http://h/assets/map-fig5-D.avif", 40_000, 1400, { startedAt: 950 })],
      "assets/index-A.js",
    );
    expect(late).toEqual({ firstTextureAt: 950, shellDoneAt: 900, beforeShell: false });
  });

  it("has nulls, and is not before the shell, where a load had no texture or no shell", () => {
    expect(textureStartVsShell([r("http://h/assets/index-A.js", 1, 900, { startedAt: 45 })], "assets/index-A.js")).toEqual({
      firstTextureAt: null,
      shellDoneAt: 900,
      beforeShell: false,
    });
    expect(textureStartVsShell([r("http://h/assets/map-fig5-D.avif", 1, 10, { startedAt: 5 })], "assets/index-A.js")).toEqual({
      firstTextureAt: 5,
      shellDoneAt: null,
      beforeShell: false,
    });
  });
});
