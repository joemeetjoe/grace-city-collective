/**
 * The asset tier: which texture set the scene loads and how much of the
 * particle work (#38 embers, #37 ray planes) it does. Decided once at mount
 * from the viewport, the pixel density and the Save-Data hint.
 */

import type { TierWidth } from "./textureManifest";

export type TierName = "mobile" | "desktop";

export type Tier = {
  name: TierName;
  /** width of the plate texture set, in px */
  textures: "1024" | "2048";
  /** ember particle count, consumed by #38 */
  embers: number;
  /** ray planes in the light beam, consumed by #37 */
  rays: number;
  /** devicePixelRatio ceiling for the renderers (#62): a phone rasterises at 1.5 */
  dprCap: number;
  /**
   * textures uploaded per animation frame while the splash is up (#104,
   * engine/textureWarm.ts). Each upload builds a mipmap chain on the GPU: a
   * 1024² plate takes a phone's GPU a few ms, so three keep a 33 ms mobile
   * frame (framePacer's activeFps) under budget; a desktop GPU pushes a 2048²
   * plate in about the same time, so six fit a 16 ms frame. Fifty-odd
   * textures warm in under two seconds on either tier, well inside the
   * intro's three-second minimum.
   */
  warmPerFrame: number;
};

export const TIERS: Record<TierName, Tier> = {
  mobile: { name: "mobile", textures: "1024", embers: 24, rays: 2, dprCap: 1.5, warmPerFrame: 3 },
  desktop: { name: "desktop", textures: "2048", embers: 100, rays: 4, dprCap: 2, warmPerFrame: 6 },
};

/** viewports narrower than this (CSS px) take the mobile tier — the tablet breakpoint, Tailwind's `lg` */
export const TIER_NARROW_WIDTH = 1024;

/** pixel ratios below this take the mobile tier: a 1x display never resolves the 2048 plate */
export const TIER_LOW_DPR = 1.5;

export type TierInputs = {
  /** viewport width in CSS px */
  width: number;
  /** devicePixelRatio */
  dpr: number;
  /** the visitor asked for reduced data (`navigator.connection.saveData`) */
  saveData: boolean;
};

/** Pure: mobile on a narrow viewport, a low-DPR display, or under Save-Data; desktop otherwise. */
export function tierFor({ width, dpr, saveData }: TierInputs): Tier {
  if (saveData || width < TIER_NARROW_WIDTH || dpr < TIER_LOW_DPR) return TIERS.mobile;
  return TIERS.desktop;
}

/**
 * The texture set a tier loads, by plate width: the 2048 or 1024 tier written
 * by dore-recut's pack_textures.py (resolve a file with `textureUrl`).
 */
export function tierWidth(tier: Tier): TierWidth {
  return tier.textures === "1024" ? 1024 : 2048;
}

type NavigatorWithConnection = Navigator & { connection?: { saveData?: boolean } };

/** the Save-Data hint, false wherever the Network Information API is missing */
export function readSaveData(nav: Navigator = navigator): boolean {
  return (nav as NavigatorWithConnection).connection?.saveData === true;
}

/** gather the tier inputs from the browser (both seams injectable for tests) */
export function readTierInputs(win: Window = window, nav: Navigator = navigator): TierInputs {
  return { width: win.innerWidth, dpr: win.devicePixelRatio || 1, saveData: readSaveData(nav) };
}
