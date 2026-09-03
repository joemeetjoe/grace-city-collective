/**
 * The metric-matched fallback faces (#106): a `Geist Fallback` over the
 * local Arial and a `Cormorant Garamond Fallback` over the local Georgia,
 * with size-adjust and ascent, descent and line-gap overrides so that text
 * painted in the local face before the woff2 lands takes the same line
 * boxes and moves nothing when the swap happens. The stacks in fonts.ts
 * name each fallback right after its web font.
 *
 * The numbers come from fontMetrics.json, which tools/fonts/metrics.py
 * writes from the font files themselves (its docstring says which metrics
 * and why); fallbackOverrides here is the same arithmetic, so the checked-in
 * overrides can be proved against the checked-in metrics (fontFallback.test.ts).
 *
 * DOM-free, with relative imports: the css goes into the inline head style
 * (features/intro/staticSplash.ts), which vite.config.ts builds under the
 * node tsconfig.
 */
import metrics from "./fontMetrics.json";

/** a web font's latin file as measured: font units, hhea vertical metrics, the weighted average advance */
export type WebFaceMetrics = {
  unitsPerEm: number;
  ascent: number;
  descent: number;
  lineGap: number;
  xWidthAvg: number;
};

/** the local face: only its width matters, the overrides replace its vertical metrics */
export type LocalFaceMetrics = {
  unitsPerEm: number;
  xWidthAvg: number;
};

/** the four descriptors, as fractions of the font size */
export type FallbackOverrides = {
  sizeAdjust: number;
  ascent: number;
  descent: number;
  lineGap: number;
};

/** one fallback face: what it is called, what it is drawn over, and its overrides */
export type FontFallback = {
  fallbackFamily: string;
  localFamily: string;
  web: WebFaceMetrics;
  local: LocalFaceMetrics;
  overrides: FallbackOverrides;
};

/** four decimals, half up: the same expression as metrics.py's round4, so the two agree bit for bit */
export const round4 = (x: number): number => Math.floor(x * 10000 + 0.5) / 10000;

/**
 * size-adjust is the ratio of the two average advances (in ems), so the
 * local face sets a line of English to the web font's width; each override
 * is the web font's metric in ems divided by it, because the overrides are
 * applied before size-adjust scales the face.
 */
export function fallbackOverrides(web: WebFaceMetrics, local: LocalFaceMetrics): FallbackOverrides {
  const sizeAdjust = round4(web.xWidthAvg / web.unitsPerEm / (local.xWidthAvg / local.unitsPerEm));
  return {
    sizeAdjust,
    ascent: round4(web.ascent / web.unitsPerEm / sizeAdjust),
    descent: round4(-web.descent / web.unitsPerEm / sizeAdjust),
    lineGap: round4(web.lineGap / web.unitsPerEm / sizeAdjust),
  };
}

/** a fraction as the percentage a descriptor takes, two decimals */
const pct = (fraction: number): string => `${(fraction * 100).toFixed(2)}%`;

/** the @font-face for one fallback, minified for the inline head style */
export function fontFaceCss({ fallbackFamily, localFamily, overrides: o }: FontFallback): string {
  return (
    `@font-face{font-family:${JSON.stringify(fallbackFamily)};src:local(${JSON.stringify(localFamily)});` +
    `size-adjust:${pct(o.sizeAdjust)};ascent-override:${pct(o.ascent)};` +
    `descent-override:${pct(o.descent)};line-gap-override:${pct(o.lineGap)}}`
  );
}

/** every fallback face's @font-face, in order */
export const fontFallbackCss = (faces: readonly FontFallback[]): string => faces.map(fontFaceCss).join("");

/** the site's two fallbacks, sans then serif, as checked in */
export const FONT_FALLBACKS: readonly FontFallback[] = [metrics.sans, metrics.serif];

/** the css the inline head style carries, so the faces exist before any text paints */
export const FONT_FALLBACK_CSS = fontFallbackCss(FONT_FALLBACKS);
