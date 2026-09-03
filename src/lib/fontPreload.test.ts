import { describe, expect, it } from "vitest";

import { PRELOAD_FONT_STEMS, fontPreloadHrefs, fontPreloadTags } from "./fontPreload";

// what a build emits: the two latin files, their .woff sibling and the
// italic Cormorant nobody sets, plus the rest of the bundle
const files = [
  "assets/index-Ab12Cd34.js",
  "assets/index-Ef56Gh78.css",
  "assets/geist-latin-wght-normal-Ij90Kl12.woff2",
  "assets/cormorant-garamond-latin-400-normal-Mn34Op56.woff2",
  "assets/cormorant-garamond-latin-400-normal-Qr78St90.woff",
  "assets/cormorant-garamond-latin-400-italic-Uv12Wx34.woff2",
  "assets/masks-cut-1-Yz56Ab78.webp",
];

describe("fontPreloadHrefs", () => {
  it("finds the hashed woff2 of each stem, under the base, in stem order", () => {
    expect(fontPreloadHrefs(files, "/")).toEqual([
      "/assets/cormorant-garamond-latin-400-normal-Mn34Op56.woff2",
      "/assets/geist-latin-wght-normal-Ij90Kl12.woff2",
    ]);
    expect(fontPreloadHrefs(files, "/grace-city-collective/")).toEqual([
      "/grace-city-collective/assets/cormorant-garamond-latin-400-normal-Mn34Op56.woff2",
      "/grace-city-collective/assets/geist-latin-wght-normal-Ij90Kl12.woff2",
    ]);
  });

  it("preloads the two files the page paints above the fold: the serif headline and the sans", () => {
    expect(PRELOAD_FONT_STEMS).toEqual(["cormorant-garamond-latin-400-normal", "geist-latin-wght-normal"]);
  });

  it("refuses a build that has none, or more than one, of a stem", () => {
    expect(() => fontPreloadHrefs(files.filter((f) => !f.includes("geist")), "/")).toThrow(/geist-latin-wght-normal/);
    expect(() => fontPreloadHrefs([...files, "assets/geist-latin-wght-normal-Zz00.woff2"], "/")).toThrow(/found 2/);
  });
});

describe("fontPreloadTags", () => {
  it("writes a head preload link per file with as, type and crossorigin", () => {
    expect(fontPreloadTags(files, "/")).toEqual([
      {
        tag: "link",
        attrs: {
          rel: "preload",
          as: "font",
          type: "font/woff2",
          crossorigin: true,
          href: "/assets/cormorant-garamond-latin-400-normal-Mn34Op56.woff2",
        },
        injectTo: "head",
      },
      {
        tag: "link",
        attrs: { rel: "preload", as: "font", type: "font/woff2", crossorigin: true, href: "/assets/geist-latin-wght-normal-Ij90Kl12.woff2" },
        injectTo: "head",
      },
    ]);
  });
});
