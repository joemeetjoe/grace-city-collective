import * as THREE from "three";

/**
 * The scene's texture loading (#120). Every load goes through one manager so
 * the ready signal waits for all of them; every texture that lands is handed
 * to `onLand` (the warmer, textureWarm.ts). Colour textures are sharpened for
 * the engraving; depth maps are sampled at lod 0 by the vertex shader, so
 * they take no mipmaps. Masks come four to a texture, one per channel, so
 * the same file backs up to four materials and is cached by url.
 */

export type TextureSet = {
  manager: THREE.LoadingManager;
  /** a colour map (sRGB, mipmapped, anisotropic) or a depth map (linear, lod 0) */
  load(url: string, kind: "colour" | "depth"): THREE.Texture;
  /** a packed mask texture, one per url however many cuts sample it */
  mask(url: string): THREE.Texture;
  dispose(): void;
};

export type TextureSetOptions = {
  /** the back renderer's anisotropy ceiling */
  maxAniso: number;
  /** a texture has landed: queue its upload */
  onLand: (texture: THREE.Texture) => void;
};

export function createTextureSet({ maxAniso, onLand }: TextureSetOptions): TextureSet {
  const manager = new THREE.LoadingManager();
  const loader = new THREE.TextureLoader(manager);
  // masks must arrive unpremultiplied: an <img> upload may zero the colour
  // under a zero alpha, wiping three masks wherever the fourth is empty,
  // which only an ImageBitmap decoded without premultiplication guarantees
  // against
  const bitmaps = new THREE.ImageBitmapLoader(manager);
  bitmaps.setOptions({ imageOrientation: "flipY", premultiplyAlpha: "none" });
  const owned: THREE.Texture[] = [];
  const masks = new Map<string, THREE.Texture>();

  const sharpen = (t: THREE.Texture, srgb = false) => {
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    // the engraving is thousands of fine lines — without mipmaps and
    // anisotropy they alias into a shimmering woven-cloth moiré
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.anisotropy = maxAniso;
    return t;
  };

  return {
    manager,
    load(url, kind) {
      const t = loader.load(url, onLand);
      if (kind === "colour") sharpen(t, true);
      else {
        // no sharpen(): the vertex fetch samples lod 0, so mipmaps would never be read
        t.generateMipmaps = false;
        t.minFilter = THREE.LinearFilter;
        t.magFilter = THREE.LinearFilter;
      }
      owned.push(t);
      return t;
    },
    mask(url) {
      let t = masks.get(url);
      if (!t) {
        const made = sharpen(new THREE.Texture());
        made.flipY = false; // orientation is fixed at decode for an ImageBitmap
        masks.set(url, made);
        bitmaps.load(url, (bitmap) => {
          made.image = bitmap;
          made.needsUpdate = true;
          onLand(made);
        });
        t = made;
      }
      return t;
    },
    dispose() {
      for (const t of owned) t.dispose();
      for (const t of masks.values()) t.dispose();
    },
  };
}
