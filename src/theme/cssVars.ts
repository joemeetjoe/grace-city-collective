import type { CSSProperties } from "react";

/** a CSS custom property's name */
export type CssVarName = `--${string}`;

/**
 * A React style object that may carry CSS custom properties beside the
 * named properties, in whatever order they should reach the element.
 */
export type CssVarStyle = CSSProperties & Partial<Record<CssVarName, string | number>>;

/**
 * CSS custom properties in a style object, typed once: React's CSSProperties
 * has no room for `--x`, so every `style={{ "--x": … }}` used to carry its
 * own cast. The keys keep their order — React writes inline styles in it —
 * and a misspelt named property is still an error.
 */
export function cssVars(style: CssVarStyle): CSSProperties {
  return style as CSSProperties;
}
