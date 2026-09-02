/**
 * The hero-critical textures, preloaded for the tier the device actually
 * gets. A static <link rel="preload"> in index.html can only name one tier,
 * so a phone would fetch the 2048 set on top of its own; these are injected
 * once the tier is decided instead.
 */

import { textureUrl } from "./textureManifest";
import { tierWidth, type Tier } from "./tier";

export type PreloadLink = { href: string; as: "image" | "fetch"; type?: string };

/** plate, backdrop, the packed masks of the nearest apostles, and their maps */
const HERO_TEXTURES: ReadonlyArray<{ file: string; as: PreloadLink["as"] }> = [
  { file: "plate.webp", as: "image" },
  { file: "plate-backdrop.webp", as: "image" },
  // the mask packs go through createImageBitmap → fetch(), which an
  // as="image" preload would never match
  { file: "masks-cut-0.webp", as: "fetch" },
  { file: "map-fig5.webp", as: "image" },
  { file: "map-fig10.webp", as: "image" },
];

/** the hero set's hashed urls for the tier; `url` is injectable for tests */
export function preloadLinks(tier: Tier, url: typeof textureUrl = textureUrl): PreloadLink[] {
  const width = tierWidth(tier);
  return HERO_TEXTURES.map(({ file, as }) => ({
    href: url(width, file),
    as,
    ...(as === "image" ? { type: "image/webp" } : {}),
  }));
}

const MARK = "data-tier-preload";

/** add the tier's preloads to <head>; a second call is a no-op */
export function injectPreloads(tier: Tier, doc: Document = document): void {
  if (doc.head.querySelector(`link[${MARK}]`)) return;
  for (const l of preloadLinks(tier)) {
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
