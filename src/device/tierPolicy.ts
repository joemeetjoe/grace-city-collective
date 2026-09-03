/**
 * The numbers the tier is decided by, on their own: tier.ts applies them in
 * the bundle (tierFor), and the inline head script (tierPreload.ts, built
 * under the node tsconfig) mirrors them, so the two never drift. DOM-free,
 * reaching the theme by relative path (vite.config.ts loads this graph
 * before the `@` alias exists).
 */
import { LG_PX } from "../theme/breakpoints";

/** viewports narrower than this (CSS px) take the mobile tier — the tablet breakpoint, Tailwind's `lg` */
export const TIER_NARROW_WIDTH = LG_PX;

/** pixel ratios below this take the mobile tier: a 1x display never resolves the 2048 plate */
export const TIER_LOW_DPR = 1.5;

/** the plate width each tier's texture set is cut at (src/assets/dore/<width>/, dore-recut's pack_textures.py) */
export const TIER_TEXTURES = { mobile: "1024", desktop: "2048" } as const;
