/**
 * What a tier's texture file is, from its name alone: the colour textures
 * (the backdrop and the cut maps — lossy, shipped in AVIF and WebP, #101),
 * the packed masks (lossless, read through fetch + createImageBitmap) and
 * the depth maps (lossless, read as images). Each kind is preloaded
 * differently (preload.ts from the bundle, tierPreload.ts from the head),
 * and the manifest picks a colour texture's AVIF twin by the same test.
 *
 * DOM-free with no imports: vite.config.ts reaches this through
 * tierPreload.ts under the node tsconfig.
 */

export type TextureKind = "colour" | "mask" | "depth";

const COLOUR_TEXTURE = /^(plate-backdrop|map-[^/.]+)\.webp$/;

/** the backdrop and the cut maps — the lossy textures the pack writes in both formats */
export function isColourTexture(file: string): boolean {
  return COLOUR_TEXTURE.test(file);
}

/** a tier file's kind; a name that is none of them is an error */
export function textureKind(file: string): TextureKind {
  if (isColourTexture(file)) return "colour";
  if (/^masks-[^/]+\.webp$/.test(file)) return "mask";
  if (/^depth(-[^/.]+)?\.webp$/.test(file)) return "depth";
  throw new Error(`${file} is not a tier texture`);
}

/**
 * the `as` a preload of the kind needs: the mask packs go through
 * createImageBitmap → fetch(), which an as="image" preload would never match
 */
export function preloadAs(kind: TextureKind): "image" | "fetch" {
  return kind === "mask" ? "fetch" : "image";
}

/**
 * The hero-critical set, in priority order: the backdrop, then the four
 * nearest cuts — the floor and the foreground apostles, packed together in
 * masks-cut-0 — with their maps (there is no whole-plate texture any more,
 * #99: every cut samples a crop of its own). Preloaded first, so the
 * browser's priority follows.
 */
export const HERO_TEXTURES: readonly string[] = [
  "plate-backdrop.webp",
  "masks-cut-0.webp",
  "map-floor.webp",
  "map-fig13.webp",
  "map-fig5.webp",
  "map-fig10.webp",
];
