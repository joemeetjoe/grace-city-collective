/**
 * The site's two font stacks. The `@theme` block in index.css declares the
 * same values as `--font-sans` and `--font-serif` for Tailwind (`font-sans`,
 * `font-serif`); fonts.test.ts keeps the two in sync. Use these where a
 * font-family is written outside Tailwind (SVG text, inline styles, markup
 * that paints before the stylesheet).
 *
 * Each web font is followed by its metric-matched fallback
 * (fontFallback.ts), then the local face the fallback is drawn over, so a
 * reader without the fallback face still lands on the same local font.
 */
export const FONT_SANS = "'Geist Variable', 'Geist Fallback', Arial, sans-serif";
export const FONT_SERIF = "'Cormorant Garamond', 'Cormorant Garamond Fallback', Georgia, serif";
