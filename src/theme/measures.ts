/**
 * The measures the layers share, as numbers: each is `--spacing-<name>` in
 * index.css (`@theme static`), a clamp in px and vw, and a Tailwind utility
 * reads it there (`px-gutter`, `inset-frame-inset`, `p-panel-pad`,
 * `pb-lockup-foot`; classes.ts). The stylesheet loads without blocking the
 * first paint (vite.config.ts asyncCss), so the inline head style — the
 * splash and the hero's box on it (features/intro/staticSplash.ts,
 * stops/heroMetrics.ts) — cannot read the variables and writes the clamp
 * out from these points instead; measures.test.ts keeps the two in step.
 * DOM-free, with no imports: the inline-head graph reaches here by
 * relative path.
 */

/** a measure that grows with the viewport width between two px bounds: `clamp(<min>px, <vw>vw, <max>px)` */
export type VwClamp = readonly [min: number, vw: number, max: number];

/** every section's horizontal padding */
export const GUTTER: VwClamp = [20, 4.4, 60];
/** the scene frame's inset from the viewport edge: the border, the nav bar and the brackets */
export const FRAME_INSET: VwClamp = [9, 2.4, 26];
/** a copy panel's padding, and the column its tuck clears less it */
export const PANEL_PAD: VwClamp = [18, 2.6, 32];
/** the lockup's clearance at the hero's foot */
export const LOCKUP_FOOT: VwClamp = [22, 4.2, 52];

/** every measure by its `--spacing-*` name in index.css (measures.test.ts) */
export const CSS_MEASURES: Readonly<Record<string, VwClamp>> = {
  gutter: GUTTER,
  "frame-inset": FRAME_INSET,
  "panel-pad": PANEL_PAD,
  "lockup-foot": LOCKUP_FOOT,
};

/** the measure as CSS, without spaces, as an inline style writes it */
export function vwClamp([min, vw, max]: VwClamp): string {
  return `clamp(${min}px,${vw}vw,${max}px)`;
}
