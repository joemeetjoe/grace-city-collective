/**
 * Brand colour tokens. The CSS `@theme` block in index.css declares the same
 * values for Tailwind (`bg-seal`, `text-cream`, …); tokens.test.ts keeps the
 * two in sync. Use these in code that paints outside Tailwind (SVG, WebGL).
 */
export const tokens = {
  /** page ground */
  ink: "#14100e",
  /** type and rules */
  cream: "#f9f4ed",
  /** wax body — the site accent */
  seal: "#9e1f2e",
  /** shadowed wax, hover states */
  sealDeep: "#5c0f1b",
  /** warm copper specular on the wax, lit by the Pentecost flames. Seal artwork only. */
  sealHighlight: "#d67f48",
} as const;

export type Token = keyof typeof tokens;

/** CSS custom-property name Tailwind exposes for a token (`--color-seal-deep`). */
export function cssVar(token: Token): string {
  return `--color-${token.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
}

function channel(hex: string, i: number): number {
  const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.x relative luminance of a `#rrggbb` colour. */
export function luminance(hex: string): number {
  return 0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2);
}

/** WCAG contrast ratio between two `#rrggbb` colours, 1..21. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
