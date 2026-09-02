/**
 * The hero-critical textures, preloaded from the bundle for the tier the
 * device actually gets — the fallback for a page whose head script did not
 * run. The built index.html preloads the whole tier from an inline head
 * script (tierPreload.ts, #113) and marks its links with TIER_PRELOAD_ATTR;
 * where those are present this is a no-op. A static <link rel="preload">
 * in index.html could only name one tier, so a phone would fetch the 2048
 * set on top of its own; these are injected once the tier is decided
 * instead — and once the AVIF verdict is in (device/avif.ts, a few ms): a
 * link must name the very file the loader will request, so the colour
 * textures follow the chosen format.
 */

import { textureUrl, type TextureFormat } from "./textureManifest";
import { HERO_TEXTURES, preloadAs, textureKind } from "./textureKinds";
import { TIER_PRELOAD_ATTR } from "./tierPreload";
import { tierWidth, type Tier } from "./tier";

export type PreloadLink = { href: string; as: "image" | "fetch"; type?: string };

/** the mime type of an image link, from the file the resolver chose */
const imageType = (href: string): string => (href.endsWith(".avif") ? "image/avif" : "image/webp");

/** the hero set's hashed urls for the tier in the client's format; `url` is injectable for tests */
export function preloadLinks(tier: Tier, format: TextureFormat, url: typeof textureUrl = textureUrl): PreloadLink[] {
  const width = tierWidth(tier);
  return HERO_TEXTURES.map((file) => {
    const as = preloadAs(textureKind(file));
    const href = url(width, file, format);
    return { href, as, ...(as === "image" ? { type: imageType(href) } : {}) };
  });
}

/** add the tier's preloads to <head>; a second call, or one after the head script's links, is a no-op */
export function injectPreloads(tier: Tier, format: TextureFormat, doc: Document = document): void {
  if (doc.head.querySelector(`link[${TIER_PRELOAD_ATTR}]`)) return;
  for (const l of preloadLinks(tier, format)) {
    const link = doc.createElement("link");
    link.rel = "preload";
    link.setAttribute("as", l.as);
    if (l.type) link.type = l.type;
    link.href = l.href;
    // three.js loads images anonymously; a preload with another credentials
    // mode is fetched twice
    link.setAttribute("crossorigin", "anonymous");
    link.setAttribute(TIER_PRELOAD_ATTR, "");
    doc.head.appendChild(link);
  }
}
