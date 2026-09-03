/**
 * Where the scene's textures live and how a cut's mask is read out of them.
 *
 * The dore-recut project's pack_textures.py writes one tier per plate width
 * under src/assets/dore/<width>/, each with its own cuts.json. Vite imports
 * every file there (#97): each texture ships from dist/assets/ under a
 * content-hashed name — cached forever, like the bundle — and cuts.json is
 * bundled rather than fetched. This module owns the one glob; everything
 * else resolves a tier's file name through `textureUrl`.
 *
 * The colour textures — the backdrop and every cut map — ship twice (#101):
 * the pack writes an AVIF twin beside each WebP, and cuts.json goes on
 * naming the `.webp`. A resolver asked for `{ avif: true }` (device/avif.ts
 * decides, once per client) hands out the twin where the tier has one; the
 * masks and depths are lossless WebP and never swap.
 *
 * Masks are packed four to a lossless RGBA WebP and referenced as
 * { file, channel }; the fragment shader reads the channel with
 * dot(texture2D(mask, uv), uMaskChannel), where uMaskChannel is
 * channelVector(channel).
 */

import { isColourTexture } from "./textureKinds";

/** which channel of which packed texture holds a cut's mask */
export type MaskRef = { file: string; channel: number };

export type TierWidth = 2048 | 1024;

/** `<width>/<file>` → the url the file is served from */
export type TextureTable = Readonly<Record<string, string>>;

/** resolves one tier's file name to its url */
export type TextureResolver = (file: string) => string;

const TIER_FILE = /\/dore\/(\d+)\/([^/]+)$/;

/** `/src/assets/dore/2048/plate.webp` → `2048/plate.webp` */
function tierKey(path: string): string {
  const m = TIER_FILE.exec(path);
  if (!m) throw new Error(`${path} is not a tier texture`);
  return `${m[1]}/${m[2]}`;
}

const hashedUrls = import.meta.glob("/src/assets/dore/*/*.{webp,avif}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const bundledCuts = import.meta.glob("/src/assets/dore/*/cuts.json", { eager: true, import: "default" }) as Record<
  string,
  unknown
>;

/** every texture of both tiers, keyed `<width>/<file>` */
export const TEXTURE_TABLE: TextureTable = Object.fromEntries(
  Object.entries(hashedUrls).map(([path, url]) => [tierKey(path), url]),
);

/** which encoding the colour textures are requested in; the lossless masks and depths are unaffected */
export type TextureFormat = { avif: boolean };

/**
 * Pure: a tier's file name to its url out of `table`; a file the tier lacks
 * is an error. With `avif`, a colour texture resolves to its `.avif` twin
 * when the tier has it and to the `.webp` otherwise.
 */
export function resolveTexture(table: TextureTable, width: TierWidth, file: string, format?: TextureFormat): string {
  if (format?.avif && isColourTexture(file)) {
    const twin = table[`${width}/${file.replace(/\.webp$/, ".avif")}`];
    if (twin !== undefined) return twin;
  }
  const url = table[`${width}/${file}`];
  if (url === undefined) throw new Error(`no texture ${width}/${file} in the manifest`);
  return url;
}

/** the hashed url of one of a tier's textures, in the format the client takes */
export function textureUrl(width: TierWidth, file: string, format?: TextureFormat): string {
  return resolveTexture(TEXTURE_TABLE, width, file, format);
}

/** the tier's cuts.json, bundled: raw, for parseCuts */
export function tierCuts(width: TierWidth): unknown {
  const key = `${width}/cuts.json`;
  const entry = Object.entries(bundledCuts).find(([path]) => tierKey(path) === key);
  if (!entry) throw new Error(`no ${key} in the manifest`);
  return entry[1];
}

export type MaskSource = { url: string; channel: number };

/**
 * A cut's mask texture and the channel it occupies. A legacy entry with no
 * mask reference is its own greyscale png, read from the red channel.
 */
export function maskRef(cut: { name: string; mask?: MaskRef }, resolve: TextureResolver): MaskSource {
  if (cut.mask) return { url: resolve(cut.mask.file), channel: cut.mask.channel };
  return { url: resolve(`cut-${cut.name}.png`), channel: 0 };
}

const MASK_CHANNELS = 4;

/** the vec4 that picks one channel of an rgba sample when dotted with it */
export function channelVector(channel: number): [number, number, number, number] {
  if (!Number.isInteger(channel) || channel < 0 || channel >= MASK_CHANNELS) {
    throw new RangeError(`mask channel ${channel} is not one of 0..${MASK_CHANNELS - 1}`);
  }
  const v: [number, number, number, number] = [0, 0, 0, 0];
  v[channel] = 1;
  return v;
}
