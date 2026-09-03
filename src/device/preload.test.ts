import { describe, expect, it } from "vitest";

import { TIERS } from "./tier";
import { injectPreloads, preloadLinks } from "./preload";
import { textureUrl, type TextureFormat } from "./textureManifest";
import { TIER_PRELOAD_ATTR } from "./tierPreload";

const fake = (width: number, file: string, format?: TextureFormat) =>
  `/assets/${width}-${format?.avif && file.startsWith("map-") ? file.replace(/\.webp$/, ".avif") : file}`;
const WEBP: TextureFormat = { avif: false };
const AVIF: TextureFormat = { avif: true };

describe("preloadLinks", () => {
  it("names the hero-critical textures of the chosen tier through the resolver", () => {
    const links = preloadLinks(TIERS.mobile, WEBP, fake);
    expect(links.map((l) => l.href)).toEqual([
      "/assets/1024-plate-backdrop.webp",
      "/assets/1024-masks-cut-0.webp",
      "/assets/1024-map-floor.webp",
      "/assets/1024-map-fig13.webp",
      "/assets/1024-map-fig5.webp",
      "/assets/1024-map-fig10.webp",
    ]);
    expect(preloadLinks(TIERS.desktop, WEBP, fake).every((l) => l.href.startsWith("/assets/2048-"))).toBe(true);
  });

  it("resolves to the hashed urls of the tier's own textures by default", () => {
    const desktop = preloadLinks(TIERS.desktop, WEBP).map((l) => l.href);
    const mobile = preloadLinks(TIERS.mobile, WEBP).map((l) => l.href);
    expect(desktop[0]).toBe(textureUrl(2048, "plate-backdrop.webp"));
    expect(mobile[0]).toBe(textureUrl(1024, "plate-backdrop.webp"));
    expect(desktop.some((href) => mobile.includes(href))).toBe(false);
  });

  it("preloads the packed masks as a fetch, everything else as an image typed by its format", () => {
    const links = preloadLinks(TIERS.desktop, WEBP, fake);
    const masks = links.find((l) => l.href.includes("masks-cut-0"));
    expect(masks?.as).toBe("fetch");
    expect(masks?.type).toBeUndefined();
    expect(links.filter((l) => l !== masks).every((l) => l.as === "image" && l.type === "image/webp")).toBe(true);
  });

  it("follows an avif verdict: the twin's url and type wherever the resolver hands one out", () => {
    const links = preloadLinks(TIERS.desktop, AVIF, fake);
    const maps = links.filter((l) => l.href.includes("map-"));
    expect(maps).toHaveLength(4);
    expect(maps.every((l) => l.href.endsWith(".avif") && l.type === "image/avif")).toBe(true);
    // the fake resolver has no avif backdrop: the link stays webp-typed
    expect(links[0]).toEqual({ href: "/assets/2048-plate-backdrop.webp", as: "image", type: "image/webp" });
    expect(links[1]).toEqual({ href: "/assets/2048-masks-cut-0.webp", as: "fetch" });
    expect(links.some((l) => l.href.endsWith(".webp") && l.href.includes("map-"))).toBe(false);
  });
});

describe("injectPreloads", () => {
  it("appends one anonymous-crossorigin link per texture to the head, once", () => {
    const doc = document.implementation.createHTMLDocument();
    injectPreloads(TIERS.desktop, WEBP, doc);
    injectPreloads(TIERS.desktop, WEBP, doc);
    const links = Array.from(doc.head.querySelectorAll('link[rel="preload"]'));
    expect(links).toHaveLength(6);
    expect(links.every((l) => l.getAttribute("crossorigin") === "anonymous")).toBe(true);
    expect(links[0].getAttribute("href")).toBe(textureUrl(2048, "plate-backdrop.webp"));
    expect(links.every((l) => l.getAttribute("href")?.endsWith(".webp"))).toBe(true);
  });

  it("injects the avif twins, typed image/avif, under an avif verdict", () => {
    const doc = document.implementation.createHTMLDocument();
    injectPreloads(TIERS.mobile, AVIF, doc);
    const links = Array.from(doc.head.querySelectorAll('link[rel="preload"][as="image"]'));
    expect(links).toHaveLength(5);
    expect(links.every((l) => l.getAttribute("href")?.endsWith(".avif") && l.getAttribute("type") === "image/avif")).toBe(true);
    expect(links[0].getAttribute("href")).toBe(textureUrl(1024, "plate-backdrop.webp", AVIF));
  });

  it("stays out of a head the build's inline script has already filled (its links carry the same mark)", () => {
    const doc = document.implementation.createHTMLDocument();
    const fromHead = doc.createElement("link");
    fromHead.rel = "preload";
    fromHead.href = "/assets/plate-backdrop-abc.avif";
    fromHead.setAttribute(TIER_PRELOAD_ATTR, "");
    doc.head.appendChild(fromHead);
    injectPreloads(TIERS.desktop, AVIF, doc);
    expect(Array.from(doc.head.querySelectorAll("link")).map((l) => l.getAttribute("href"))).toEqual([
      "/assets/plate-backdrop-abc.avif",
    ]);
  });
});
