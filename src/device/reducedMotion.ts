/**
 * Kept free of DOM reads so the static splash's inline script
 * (intro/staticSplash.ts, built under the node tsconfig) can share it;
 * that graph must import this file by relative path.
 */
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
