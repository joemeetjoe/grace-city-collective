/**
 * The intro policy's two keys, on their own so the static splash's inline
 * script (staticSplash.ts, built under the node tsconfig) can share them
 * without pulling in the DOM-reading policy.
 */

/** sessionStorage flag: the intro has played (or been skipped) this browser session */
export const INTRO_PLAYED_KEY = "gcc:intro-played";

export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
