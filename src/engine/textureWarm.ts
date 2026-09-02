/**
 * Warms textures a few per frame (#104). A texture reaches the GPU the first
 * time a renderer draws it — the upload, the mipmap chain and the anisotropy
 * all inside that draw — so a scene whose textures all landed behind the
 * splash paid for every one of them in the first frame after the handoff.
 * The warmer takes each texture as it arrives and hands it to `initTexture`
 * (the renderer's own `initTexture`, which forces the upload) at most
 * `perFrame` per tick, so the uploads spread across the frames the splash is
 * on screen and the first drawn frame issues none.
 *
 * Pure and clock-free: the caller ticks it once per animation frame while
 * anything is pending. A texture is warmed once however often it is added.
 */

export type TextureWarmer<T> = {
  /** queue a texture that has landed; a repeat is ignored */
  add(texture: T): void;
  /** warm up to `perFrame` queued textures; returns how many this tick */
  tick(): number;
  /** textures queued and not yet warmed */
  pending(): number;
};

export type TextureWarmerOptions<T> = {
  /** forces the upload: the renderer's `initTexture` */
  initTexture: (texture: T) => void;
  /** the per-frame ceiling (the tier's `warmPerFrame`); at least one per tick */
  perFrame: number;
};

export function createTextureWarmer<T>({ initTexture, perFrame }: TextureWarmerOptions<T>): TextureWarmer<T> {
  const perTick = Math.max(1, Math.floor(perFrame));
  const seen = new Set<T>();
  const queue: T[] = [];
  return {
    add(texture) {
      if (seen.has(texture)) return;
      seen.add(texture);
      queue.push(texture);
    },
    tick() {
      const batch = queue.splice(0, perTick);
      for (const texture of batch) initTexture(texture);
      return batch.length;
    },
    pending() {
      return queue.length;
    },
  };
}
