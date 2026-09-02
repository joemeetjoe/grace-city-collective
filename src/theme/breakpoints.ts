/**
 * The one breakpoint the script keys on: Tailwind's `lg`, 64rem at the 16px
 * root, at and above which the desktop layout applies (`lg:` variants,
 * TUCK in classes.ts). Below it the scene scrolls natively, the copy sits on
 * the scene, the lockup stacks (layout/breakpoint.ts) and the mobile asset
 * tier is taken (device/tierPolicy.ts) — one number, so CSS and script agree
 * by construction. DOM-free, with no imports: tierPolicy.ts is loaded by
 * vite.config.ts at build and reaches here by relative path.
 */
export const LG_PX = 1024;
