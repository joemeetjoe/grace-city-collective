import { brotliCompressSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { wireSize } from "./budgetReport.mjs";

describe("wireSize", () => {
  it("counts text files at their brotli size, like the CDN sends them", () => {
    const text = Buffer.from("const a = 1;\n".repeat(200));
    expect(wireSize(text, "js")).toBe(brotliCompressSync(text).length);
    expect(wireSize(text, "js")).toBeLessThan(text.length);
    for (const ext of ["html", "css", "json", "svg"]) expect(wireSize(text, ext)).toBe(brotliCompressSync(text).length);
  });

  it("counts already-compressed files (webp, woff2) at their raw size", () => {
    const bytes = Buffer.from("RIFF....WEBP".repeat(50));
    expect(wireSize(bytes, "webp")).toBe(bytes.length);
    expect(wireSize(bytes, "woff2")).toBe(bytes.length);
    expect(wireSize(bytes, "png")).toBe(bytes.length);
  });
});

import { firstLoadFiles } from "./budgetReport.mjs";

const font = (name, ext = "woff2") => [
  `node_modules/.pnpm/x/node_modules/@fontsource/y/files/${name}.${ext}`,
  { file: `assets/${name}-H4sh.${ext}` },
];
const texture = (width, name, ext = "webp") => [
  `src/assets/dore/${width}/${name}.${ext}`,
  { file: `assets/${name}-${width}h.${ext}` },
];

const manifest = Object.fromEntries([
  [
    "index.html",
    {
      file: "assets/index-Sh3ll.js",
      isEntry: true,
      css: ["assets/index-Sty1e.css"],
      dynamicImports: ["src/engine/PentecostParallax.tsx", "src/features/longform/Longform.tsx"],
      assets: ["assets/plate-2048h.webp"],
    },
  ],
  ["src/engine/PentecostParallax.tsx", { file: "assets/PentecostParallax-Eng1ne.js", isDynamicEntry: true }],
  ["src/features/longform/Longform.tsx", { file: "assets/Longform-L0ng.js", isDynamicEntry: true }],
  font("geist-latin-wght-normal"),
  font("geist-cyrillic-wght-normal"),
  font("cormorant-garamond-latin-400-normal"),
  font("cormorant-garamond-latin-400-normal", "woff"),
  font("cormorant-garamond-latin-300-normal"),
  ["src/assets/poster/dore-pentecost-dark-640.avif", { file: "assets/dore-pentecost-dark-640-P0ster.avif" }],
  ["src/assets/poster/dore-pentecost-dark-640.webp", { file: "assets/dore-pentecost-dark-640-P0ster.webp" }],
  ["src/assets/poster/dore-pentecost-dark-2048.avif", { file: "assets/dore-pentecost-dark-2048-P0ster.avif" }],
  ["src/assets/poster/dore-pentecost-dark-2048.webp", { file: "assets/dore-pentecost-dark-2048-P0ster.webp" }],
  texture(2048, "plate-backdrop"),
  texture(2048, "plate-backdrop", "avif"),
  texture(2048, "map-floor"),
  texture(2048, "map-floor", "avif"),
  texture(2048, "map-dove"),
  texture(2048, "masks-cut-0"),
  texture(2048, "depth"),
  texture(1024, "plate-backdrop"),
  texture(1024, "plate-backdrop", "avif"),
  texture(1024, "masks-cut-0"),
]);
const listing = ["index.html", "favicon.svg", "apple-touch-icon.png", "assets/index-Sh3ll.js", ".vite/manifest.json"];

describe("firstLoadFiles", () => {
  it("lists the html, favicon, shell, engine, css, latin fonts and the tier's own textures on the avif path", () => {
    const files = firstLoadFiles(manifest, 2048, listing);
    expect(files).toEqual([
      { path: "index.html", category: "html" },
      { path: "favicon.svg", category: "other" },
      { path: "assets/index-Sh3ll.js", category: "js" },
      { path: "assets/index-Sty1e.css", category: "css" },
      { path: "assets/PentecostParallax-Eng1ne.js", category: "js" },
      { path: "assets/geist-latin-wght-normal-H4sh.woff2", category: "font" },
      { path: "assets/cormorant-garamond-latin-400-normal-H4sh.woff2", category: "font" },
      // a colour texture once, as its avif twin; the webp is fallback-only
      { path: "assets/plate-backdrop-2048h.avif", category: "texture" },
      { path: "assets/map-floor-2048h.avif", category: "texture" },
      // a colour texture without a twin still ships as webp
      { path: "assets/map-dove-2048h.webp", category: "texture" },
      // the masks and depths are lossless webp on every path
      { path: "assets/masks-cut-0-2048h.webp", category: "texture" },
      { path: "assets/depth-2048h.webp", category: "texture" },
    ]);
  });

  it("leaves out a dynamic import the head does not module-preload: the long-form chunk arrives on demand (#111)", () => {
    const paths = firstLoadFiles(manifest, 2048, listing).map((f) => f.path);
    expect(paths).not.toContain("assets/Longform-L0ng.js");
    expect(paths.filter((p) => p.endsWith(".js"))).toEqual(["assets/index-Sh3ll.js", "assets/PentecostParallax-Eng1ne.js"]);
  });

  it("takes the other tier's textures for the other width, and never both", () => {
    const paths = firstLoadFiles(manifest, 1024, listing).map((f) => f.path);
    expect(paths).toContain("assets/plate-backdrop-1024h.avif");
    expect(paths).toContain("assets/masks-cut-0-1024h.webp");
    expect(paths.filter((p) => /\.(webp|avif)$/.test(p))).toHaveLength(2);
    expect(paths.some((p) => p.includes("2048h"))).toBe(false);
  });

  it("fails loudly when the manifest has no entry, no engine chunk or none of the tier's textures", () => {
    expect(() => firstLoadFiles({}, 2048, listing)).toThrow(/entry/);
    const { "src/engine/PentecostParallax.tsx": _engine, ...noEngine } = manifest;
    expect(() => firstLoadFiles(noEngine, 2048, listing)).toThrow(/PentecostParallax/);
    expect(() => firstLoadFiles(manifest, 4096, listing)).toThrow(/4096/);
  });
});

import { checkBudget, formatBudgetTable, sumByCategory } from "./budgetReport.mjs";

const sized = (category, bytes) => ({ path: `x.${category}`, category, bytes });
const desktop = sumByCategory([
  sized("html", 1024),
  sized("js", 200 * 1024),
  sized("js", 100 * 1024),
  sized("css", 10 * 1024),
  sized("font", 50 * 1024),
  sized("texture", 1500 * 1024),
  sized("texture", 500 * 1024),
]);
const ceilings = { desktop: { total: 2500, html: 2, js: 350, css: 12, font: 60, texture: 2300, other: 1 } };

describe("sumByCategory", () => {
  it("adds bytes and files per category, and a grand total", () => {
    expect(desktop.js).toEqual({ bytes: 300 * 1024, count: 2 });
    expect(desktop.texture).toEqual({ bytes: 2000 * 1024, count: 2 });
    expect(desktop.other).toEqual({ bytes: 0, count: 0 });
    expect(desktop.total).toBe(2361 * 1024);
  });
});

describe("checkBudget", () => {
  it("finds no breach while every category and the total sit under their kB ceilings", () => {
    expect(checkBudget({ desktop }, ceilings)).toEqual([]);
  });

  it("names each category over its ceiling, and the total over its own", () => {
    const tight = { desktop: { ...ceilings.desktop, js: 299, texture: 1999 } };
    expect(checkBudget({ desktop }, tight)).toEqual([
      { tier: "desktop", category: "js", bytes: 300 * 1024, ceiling: 299 * 1024 },
      { tier: "desktop", category: "texture", bytes: 2000 * 1024, ceiling: 1999 * 1024 },
    ]);
    const total = { desktop: { ...ceilings.desktop, total: 2360 } };
    expect(checkBudget({ desktop }, total)).toEqual([
      { tier: "desktop", category: "total", bytes: 2361 * 1024, ceiling: 2360 * 1024 },
    ]);
  });

  it("refuses a budget file with a tier or category missing", () => {
    expect(() => checkBudget({ desktop, mobile: desktop }, ceilings)).toThrow(/mobile/);
    const { font: _font, ...noFont } = ceilings.desktop;
    expect(() => checkBudget({ desktop }, { desktop: noFont })).toThrow(/font/);
  });
});

describe("formatBudgetTable", () => {
  it("prints one block per tier: files, measured kB, ceiling kB and headroom per category, marking a breach", () => {
    const text = formatBudgetTable({ desktop }, { desktop: { ...ceilings.desktop, js: 299 } });
    expect(text).toContain("desktop");
    expect(text).toMatch(/html\s+1\s+1\.0\s+2\.0\s+1\.0\s*$/m);
    expect(text).toMatch(/js\s+2\s+300\.0\s+299\.0\s+-1\.0\s+OVER\s*$/m);
    expect(text).toMatch(/texture\s+2\s+2000\.0\s+2300\.0\s+300\.0\s*$/m);
    expect(text).toMatch(/total\s+7\s+2361\.0\s+2500\.0\s+139\.0\s*$/m);
  });
});

import { TIER_WIDTHS } from "./budgetReport.mjs";
import { TIERS, tierWidth } from "../../src/device/tier";

describe("TIER_WIDTHS", () => {
  it("mirrors the tiers the app decides between (src/device/tier.ts)", () => {
    expect(TIER_WIDTHS).toEqual(Object.fromEntries(Object.values(TIERS).map((t) => [t.name, tierWidth(t)])));
  });
});

import { firstLoadPoster, TIER_POSTER_RUNGS } from "./budgetReport.mjs";
import { PROFILES } from "./transferReport.mjs";
import { posterSource } from "../../src/engine/posterLadder";

describe("firstLoadPoster", () => {
  it("names the AVIF rung a tier's poster path requests, as a texture", () => {
    expect(firstLoadPoster(manifest, 2048)).toEqual({ path: "assets/dore-pentecost-dark-2048-P0ster.avif", category: "texture" });
    expect(firstLoadPoster(manifest, 640, "webp")).toEqual({ path: "assets/dore-pentecost-dark-640-P0ster.webp", category: "texture" });
  });

  it("fails loudly when the ladder has no such rung", () => {
    expect(() => firstLoadPoster(manifest, 960)).toThrow(/960/);
  });
});

describe("TIER_POSTER_RUNGS", () => {
  it("is the rung each transfer profile picks (src/engine/posterLadder.ts over PROFILES), the poster row's file", () => {
    expect(TIER_POSTER_RUNGS).toEqual(
      Object.fromEntries(Object.entries(PROFILES).map(([tier, p]) => [tier, posterSource({ ...p, saveData: false }).rung])),
    );
    expect(TIER_POSTER_RUNGS).toEqual({ desktop: 2048, mobile: 640 });
  });
});

describe("the poster row", () => {
  const withPoster = { ...desktop, poster: { bytes: 300 * 1024, count: 1 } };
  const posterCeilings = { desktop: { ...ceilings.desktop, poster: 400 } };

  it("is checked against its own ceiling and never added to the total", () => {
    expect(checkBudget({ desktop: withPoster }, posterCeilings)).toEqual([]);
    expect(checkBudget({ desktop: withPoster }, { desktop: { ...posterCeilings.desktop, poster: 299 } })).toEqual([
      { tier: "desktop", category: "poster", bytes: 300 * 1024, ceiling: 299 * 1024 },
    ]);
    expect(() => checkBudget({ desktop: withPoster }, ceilings)).toThrow(/poster/);
  });

  it("prints after the total, and is absent when the totals carry no poster", () => {
    const text = formatBudgetTable({ desktop: withPoster }, posterCeilings);
    expect(text).toMatch(/total\s+7\s+2361\.0\s+2500\.0\s+139\.0\s*$/m);
    expect(text).toMatch(/total.*\n\s+poster\s+1\s+300\.0\s+400\.0\s+100\.0\s*$/m);
    expect(formatBudgetTable({ desktop }, ceilings)).not.toContain("poster");
  });
});
