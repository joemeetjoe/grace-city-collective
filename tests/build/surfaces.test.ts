/**
 * The SEO and AI surfaces in the built site (src/content/surfaces.ts via the
 * gcc:surfaces plugin in vite.config.ts): every head tag and root file is
 * there, parses, and carries a heading from the site content.
 */
import { readFileSync, statSync } from "node:fs";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

import { site } from "../../src/content/site";
import { SHARE_IMAGE } from "../../src/content/surfaces";
import { STATIC_SPLASH_ATTR } from "../../src/features/intro/staticSplash";
import { distIndexHtml, distPath, readDist } from "./dist";
import { bodyOf } from "./splashOrder";

const html = distIndexHtml();
const head = /<head\b[^>]*>([\s\S]*?)<\/head>/i.exec(html)?.[1] ?? "";
const body = bodyOf(html);
const document = new JSDOM(html).window.document;

const meta = (selector: string) => document.querySelector<HTMLMetaElement>(`meta[${selector}]`)?.content;
const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? "";
const AI_CRAWLERS = ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended"];

/** width and height from a JPEG's start-of-frame marker */
function jpegSize(path: string): { width: number; height: number } {
  const buf = readFileSync(path);
  let pos = 2;
  while (pos < buf.length) {
    if (buf[pos] !== 0xff) throw new Error("not a JPEG marker");
    const marker = buf[pos + 1];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buf.readUInt16BE(pos + 5), width: buf.readUInt16BE(pos + 7) };
    }
    pos += 2 + buf.readUInt16BE(pos + 2);
  }
  throw new Error("no start-of-frame in JPEG");
}

describe("dist/index.html head", () => {
  it("has a title, a description and an absolute canonical", () => {
    expect(document.title).toBe(site.name);
    expect(meta('name="description"')).toContain("living rooms across the city");
    expect(canonical).toMatch(/^https:\/\/[^/]+\/([^?#]*\/)?$/);
  });

  it("carries the Open Graph and Twitter card set, image by absolute URL", () => {
    expect(meta('property="og:type"')).toBe("website");
    expect(meta('property="og:title"')).toContain(site.name);
    expect(meta('property="og:description"')).toBeTruthy();
    expect(meta('property="og:url"')).toBe(canonical);
    expect(meta('property="og:image"')).toBe(`${canonical}${SHARE_IMAGE.file}`);
    expect(meta('name="twitter:card"')).toBe("summary_large_image");
    expect(meta('name="twitter:image"')).toBe(`${canonical}${SHARE_IMAGE.file}`);
    expect(meta('name="theme-color"')).toMatch(/^#[0-9a-f]{6}$/);
    expect(meta('name="viewport"')).toContain("width=device-width");
  });

  it("has a JSON-LD graph that parses: the Church and one Event per gathering", () => {
    const script = document.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();
    const graph = JSON.parse(script!.textContent ?? "")["@graph"] as { "@type": string; name: string }[];
    expect(graph.find((n) => n["@type"] === "Church")?.name).toBe(site.name);
    expect(graph.filter((n) => n["@type"] === "Event").map((n) => n.name)).toEqual(site.gatherings.map((g) => g.title));
    expect(head).toContain('type="application/ld+json"');
  });
});

describe("dist/index.html noscript", () => {
  const noscript = /<noscript>([\s\S]*?)<\/noscript>/i.exec(body);

  it("carries the site as plain HTML, after the splash and before #root", () => {
    expect(noscript).not.toBeNull();
    for (const s of site.longform) expect(noscript![1]).toContain(`<h2>${s.kicker}</h2>`);
    expect(noscript![1]).toContain(`<h3>${site.longform[0].heading}</h3>`);
    const splash = new RegExp(`<[a-z][^>]*\\s${STATIC_SPLASH_ATTR}\\b`, "i").exec(body)!;
    expect(splash.index).toBeLessThan(noscript!.index);
    expect(noscript!.index).toBeLessThan(body.indexOf('<div id="root">'));
    expect(noscript![1]).toContain(`[${STATIC_SPLASH_ATTR}]{display:none}`);
  });
});

describe("dist root files", () => {
  it("robots.txt lets every crawler in, names the sitemap, and carves out no AI crawler", () => {
    const robots = readDist("robots.txt");
    expect(robots).toMatch(/^User-agent: \*$/m);
    expect(robots).toMatch(/^Allow: \/$/m);
    expect(robots).not.toMatch(/^Disallow:/m);
    expect(robots).toContain(`Sitemap: ${canonical}sitemap.xml`);
    for (const bot of AI_CRAWLERS) expect(robots).not.toContain(bot);
  });

  it("sitemap.xml is well-formed and lists the one URL", () => {
    const xml = readDist("sitemap.xml");
    const parsed = new new JSDOM("").window.DOMParser().parseFromString(xml, "application/xml");
    expect(parsed.querySelector("parsererror")).toBeNull();
    const locs = [...parsed.getElementsByTagName("loc")].map((l) => l.textContent);
    expect(locs).toEqual([canonical]);
  });

  it("llms.txt says what and where, briefly, and links the full text", () => {
    const txt = readDist("llms.txt");
    expect(txt.startsWith(`# ${site.name}`)).toBe(true);
    expect(txt).toContain("West Georgia");
    expect(txt).toContain(`${canonical}llms-full.txt`);
  });

  it("llms-full.txt is the whole site in Markdown", () => {
    const md = readDist("llms-full.txt");
    for (const s of site.longform) expect(md).toContain(`## ${s.kicker}\n\n### ${s.heading}`);
    for (const q of site.faq) expect(md).toContain(`#### ${q.question}`);
    for (const g of site.gatherings) expect(md).toContain(g.when);
    expect(md).toContain(site.contact.address.street);
  });

  it("ships the share card at 1200x630 under 200 kB", () => {
    const path = distPath(SHARE_IMAGE.file);
    expect(statSync(path).size).toBeLessThan(200 * 1024);
    expect(jpegSize(path)).toEqual({ width: SHARE_IMAGE.width, height: SHARE_IMAGE.height });
  });
});
