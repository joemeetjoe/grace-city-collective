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
