import { describe, expect, it } from "vitest";

import { TIERS } from "./tier";
import { injectPreloads, preloadLinks } from "./preload";

describe("preloadLinks", () => {
  it("names the hero-critical textures of the chosen tier under the asset base", () => {
    const links = preloadLinks(TIERS.mobile, "/site/");
    expect(links.map((l) => l.href)).toEqual([
      "/site/dore/1024/plate.webp",
      "/site/dore/1024/plate-backdrop.webp",
      "/site/dore/1024/masks-cut-0.webp",
      "/site/dore/1024/map-fig5.webp",
      "/site/dore/1024/map-fig10.webp",
    ]);
  });

  it("preloads the packed masks as a fetch, everything else as an image", () => {
    const links = preloadLinks(TIERS.desktop, "/");
    const masks = links.find((l) => l.href.includes("masks-cut-0"));
    expect(masks?.as).toBe("fetch");
    expect(links.filter((l) => l !== masks).every((l) => l.as === "image" && l.type === "image/webp")).toBe(true);
  });
});

describe("injectPreloads", () => {
  it("appends one anonymous-crossorigin link per texture to the head, once", () => {
    const doc = document.implementation.createHTMLDocument();
    injectPreloads(TIERS.desktop, "/", doc);
    injectPreloads(TIERS.desktop, "/", doc);
    const links = Array.from(doc.head.querySelectorAll('link[rel="preload"]'));
    expect(links).toHaveLength(5);
    expect(links.every((l) => l.getAttribute("crossorigin") === "anonymous")).toBe(true);
    expect(links[0].getAttribute("href")).toBe("/dore/2048/plate.webp");
  });
});
