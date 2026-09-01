/**
 * Where the scene's textures live and how a cut's mask is read out of them.
 *
 * The dore-recut project's pack_textures.py writes one tier per plate width under
 * public/dore/<width>/, each with its own cuts.json. Masks there are packed
 * four to a lossless RGBA WebP and referenced as { file, channel }; the
 * fragment shader reads the channel with dot(texture2D(mask, uv), uMaskChannel),
 * where uMaskChannel is channelVector(channel).
 */

import type { Cut } from "./parallaxRelief";

export type TierWidth = 2048 | 1024;

/** the asset directory of a tier, relative to the site root */
export function tierDir(width: TierWidth): string {
  return `dore/${width}`;
}

export type MaskSource = { url: string; channel: number };

/**
 * A cut's mask texture and the channel it occupies. A legacy entry with no
 * mask reference is its own greyscale png, read from the red channel.
 */
export function maskRef(cut: Pick<Cut, "name" | "mask">, base: string): MaskSource {
  if (cut.mask) return { url: `${base}/${cut.mask.file}`, channel: cut.mask.channel };
  return { url: `${base}/cut-${cut.name}.png`, channel: 0 };
}

export const MASK_CHANNELS = 4;

/** the vec4 that picks one channel of an rgba sample when dotted with it */
export function channelVector(channel: number): [number, number, number, number] {
  if (!Number.isInteger(channel) || channel < 0 || channel >= MASK_CHANNELS) {
    throw new RangeError(`mask channel ${channel} is not one of 0..${MASK_CHANNELS - 1}`);
  }
  const v: [number, number, number, number] = [0, 0, 0, 0];
  v[channel] = 1;
  return v;
}
