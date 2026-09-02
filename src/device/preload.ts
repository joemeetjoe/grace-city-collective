/**
 * The hero-critical textures, preloaded for the tier the device actually
 * gets. A static <link rel="preload"> in index.html can only name one tier,
 * so a phone would fetch the 2048 set on top of its own; these are injected
 * once the tier is decided instead — and once the AVIF verdict is in
 * (device/avif.ts, a few ms): a link must name the very file the loader will
 * request, so the colour textures follow the chosen format.
 */

import { textureUrl, type TextureFormat } from "./textureManifest";
import { tierWidth, type Tier } from "./tier";

export type PreloadLink = { href: string; as: "image" | "fetch"; type?: string };

/**
 * the backdrop, then the four nearest cuts — the floor and the foreground
 * apostles, packed together in masks-cut-0 — with their maps (there is no
 * whole-plate texture any more, #99: every cut samples a crop of its own)
 */
const HERO_TEXTURES: ReadonlyArray<{ file: string; as: PreloadLink["as"] }> = [
  { file: "plate-backdrop.webp", as: "image" },
  // the mask packs go through createImageBitmap → fetch(), which an
  // as="image" preload would never match
  { file: "masks-cut-0.webp", as: "fetch" },
  { file: "map-floor.webp", as: "image" },
  { file: "map-fig13.webp", as: "image" },
  { file: "map-fig5.webp", as: "image" },
  { file: "map-fig10.webp", as: "image" },
];

/** the mime type of an image link, from the file the resolver chose */
const imageType = (href: string): string => (href.endsWith(".avif") ? "image/avif" : "image/webp");

/** the hero set's hashed urls for the tier in the client's format; `url` is injectable for tests */
export function preloadLinks(tier: Tier, format: TextureFormat, url: typeof textureUrl = textureUrl): PreloadLink[] {
  const width = tierWidth(tier);
  return HERO_TEXTURES.map(({ file, as }) => {
    const href = url(width, file, format);
    return { href, as, ...(as === "image" ? { type: imageType(href) } : {}) };
  });
}

const MARK = "data-tier-preload";

/** add the tier's preloads to <head>; a second call is a no-op */
export function injectPreloads(tier: Tier, format: TextureFormat, doc: Document = document): void {
  if (doc.head.querySelector(`link[${MARK}]`)) return;
  for (const l of preloadLinks(tier, format)) {
    const link = doc.createElement("link");
    link.rel = "preload";
    link.setAttribute("as", l.as);
    if (l.type) link.type = l.type;
    link.href = l.href;
    // three.js loads images anonymously; a preload with another credentials
    // mode is fetched twice
    link.setAttribute("crossorigin", "anonymous");
    link.setAttribute(MARK, "");
    doc.head.appendChild(link);
  }
}
