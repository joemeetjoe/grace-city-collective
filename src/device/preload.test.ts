import { describe, expect, it } from "vitest";

import { TIERS } from "./tier";
import { injectPreloads, preloadLinks } from "./preload";
import { textureUrl } from "./textureManifest";

const fake = (width: number, file: string) => `/assets/${width}-${file}`;

describe("preloadLinks", () => {
  it("names the hero-critical textures of the chosen tier through the resolver", () => {
    const links = preloadLinks(TIERS.mobile, fake);
    expect(links.map((l) => l.href)).toEqual([
      "/assets/1024-plate-backdrop.webp",
      "/assets/1024-masks-cut-0.webp",
      "/assets/1024-map-floor.webp",
      "/assets/1024-map-fig13.webp",
      "/assets/1024-map-fig5.webp",
      "/assets/1024-map-fig10.webp",
    ]);
    expect(preloadLinks(TIERS.desktop, fake).every((l) => l.href.startsWith("/assets/2048-"))).toBe(true);
  });

  it("resolves to the hashed urls of the tier's own textures by default", () => {
    const desktop = preloadLinks(TIERS.desktop).map((l) => l.href);
    const mobile = preloadLinks(TIERS.mobile).map((l) => l.href);
    expect(desktop[0]).toBe(textureUrl(2048, "plate-backdrop.webp"));
    expect(mobile[0]).toBe(textureUrl(1024, "plate-backdrop.webp"));
    expect(desktop.some((href) => mobile.includes(href))).toBe(false);
  });

  it("preloads the packed masks as a fetch, everything else as an image", () => {
    const links = preloadLinks(TIERS.desktop, fake);
    const masks = links.find((l) => l.href.includes("masks-cut-0"));
    expect(masks?.as).toBe("fetch");
    expect(links.filter((l) => l !== masks).every((l) => l.as === "image" && l.type === "image/webp")).toBe(true);
  });
});

describe("injectPreloads", () => {
  it("appends one anonymous-crossorigin link per texture to the head, once", () => {
    const doc = document.implementation.createHTMLDocument();
    injectPreloads(TIERS.desktop, doc);
    injectPreloads(TIERS.desktop, doc);
    const links = Array.from(doc.head.querySelectorAll('link[rel="preload"]'));
    expect(links).toHaveLength(6);
    expect(links.every((l) => l.getAttribute("crossorigin") === "anonymous")).toBe(true);
    expect(links[0].getAttribute("href")).toBe(textureUrl(2048, "plate-backdrop.webp"));
  });
});
