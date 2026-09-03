import { useTexture } from "@react-three/drei/core/Texture.js";
import { useMemo } from "react";

import type { TextureSet } from "../textures";
import { lod0, sharpen, textureSetOf, useMaskTextures, type TextureUrls } from "./sceneTextures";

/**
 * fiber + drei (#134 spike, VITE_R3F_DREI=1): colour and depth maps through
 * drei's useTexture, which is useLoader plus an immediate `gl.initTexture`
 * of every texture on the root it runs in — the back one — in one effect,
 * all at once. The masks and the front root's uploads stay with the warmers.
 */
export function useSceneTexturesDrei(urls: TextureUrls, maxAniso: number): TextureSet {
  const colour = useTexture(urls.colour);
  const depth = useTexture(urls.depth);
  const masks = useMaskTextures(urls.masks, maxAniso);
  return useMemo(() => {
    for (const t of colour) sharpen(t, maxAniso, true);
    for (const t of depth) lod0(t);
    return textureSetOf(urls, colour, depth, masks);
  }, [urls, colour, depth, masks, maxAniso]);
}
