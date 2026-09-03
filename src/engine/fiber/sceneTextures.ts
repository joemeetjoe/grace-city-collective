import { useLoader } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";

import type { TextureSet } from "../textures";

/**
 * The scene's textures through fiber's Suspense (#134 spike). `useLoader`
 * suspends the graph until every url has resolved and caches by loader and
 * url, so the two roots hand out the same THREE.Texture objects; each
 * context still uploads its own copy of what it samples (the warmers).
 *
 * Colour and depth maps go through TextureLoader; the mask packs must
 * arrive unpremultiplied (textures.ts), which only ImageBitmapLoader with
 * `premultiplyAlpha: "none"` guarantees — drei's useTexture cannot express
 * that, so the masks take this path in both variants.
 */

export type TextureUrls = { colour: string[]; depth: string[]; masks: string[] };

export const sharpen = (t: THREE.Texture, maxAniso: number, srgb = false): THREE.Texture => {
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = maxAniso;
  return t;
};

export const lod0 = (t: THREE.Texture): THREE.Texture => {
  t.generateMipmaps = false;
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  return t;
};

/** one Texture per decoded bitmap, however many renders ask */
const maskTextures = new WeakMap<ImageBitmap, THREE.Texture>();

const unpremultiplied = (l: THREE.ImageBitmapLoader) => l.setOptions({ imageOrientation: "flipY", premultiplyAlpha: "none" });

/** the mask packs as textures, unpremultiplied, cached per bitmap */
export function useMaskTextures(urls: string[], maxAniso: number): THREE.Texture[] {
  const bitmaps = useLoader(THREE.ImageBitmapLoader, urls, unpremultiplied);
  return useMemo(
    () =>
      bitmaps.map((bitmap) => {
        let t = maskTextures.get(bitmap);
        if (!t) {
          t = sharpen(new THREE.Texture(bitmap), maxAniso);
          t.flipY = false;
          t.needsUpdate = true;
          maskTextures.set(bitmap, t);
        }
        return t;
      }),
    [bitmaps, maxAniso],
  );
}

/** the resolved textures as the TextureSet buildLayers reads (layers.ts): a lookup, no loading */
export function textureSetOf(urls: TextureUrls, colour: THREE.Texture[], depth: THREE.Texture[], masks: THREE.Texture[]): TextureSet {
  const byUrl = new Map<string, THREE.Texture>();
  urls.colour.forEach((u, i) => byUrl.set(u, colour[i]));
  urls.depth.forEach((u, i) => byUrl.set(u, depth[i]));
  const maskByUrl = new Map<string, THREE.Texture>();
  urls.masks.forEach((u, i) => maskByUrl.set(u, masks[i]));
  const get = (map: Map<string, THREE.Texture>, url: string) => {
    const t = map.get(url);
    if (!t) throw new Error(`texture not loaded: ${url}`);
    return t;
  };
  return {
    manager: THREE.DefaultLoadingManager,
    load: (url) => get(byUrl, url),
    mask: (url) => get(maskByUrl, url),
    dispose() {
      // useLoader's cache owns the textures; nothing to free here (see README)
    },
  };
}

/** fiber alone: colour and depth maps through useLoader; the warmers upload them */
export function useSceneTexturesFiber(urls: TextureUrls, maxAniso: number): TextureSet {
  const colour = useLoader(THREE.TextureLoader, urls.colour);
  const depth = useLoader(THREE.TextureLoader, urls.depth);
  const masks = useMaskTextures(urls.masks, maxAniso);
  return useMemo(() => {
    for (const t of colour) sharpen(t, maxAniso, true);
    for (const t of depth) lod0(t);
    return textureSetOf(urls, colour, depth, masks);
  }, [urls, colour, depth, masks, maxAniso]);
}
