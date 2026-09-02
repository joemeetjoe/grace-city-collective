/**
 * The stylesheet loaded without blocking the first paint: the head paints
 * nothing the splash needs (its ink and layout are inline), so Vite's
 * `<link rel="stylesheet">` becomes a preload that turns itself into a
 * stylesheet once it has arrived, with the original link in a <noscript>
 * for a reader without scripts. Every other attribute (Vite's `crossorigin`,
 * which its module scripts share — a preload with a different credentials
 * mode is fetched twice) stays in place.
 *
 * DOM-free, with no imports: vite.config.ts applies it to the built
 * index.html (the gcc:async-css plugin), under the node tsconfig.
 */

/** the `rel` attribute of a tag, in any position, quoted or bare */
const REL = /\srel\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;

/** whether a tag is a `<link rel="stylesheet">` */
export function isStylesheetLink(tag: string): boolean {
  if (!/^<link\b/i.test(tag)) return false;
  const rel = REL.exec(tag);
  return (rel?.[1] ?? rel?.[2] ?? rel?.[3] ?? "").trim().toLowerCase() === "stylesheet";
}

/** the link as a preload that becomes a stylesheet on load */
function preloadOf(tag: string): string {
  const preload = tag.replace(REL, ' rel="preload" as="style"');
  return `${preload.slice(0, -1)} onload="this.onload=null;this.rel='stylesheet'">`;
}

/**
 * Every blocking stylesheet link in the page rewritten as a preload plus its
 * noscript fallback; a link already inside a <noscript> is left alone.
 */
export function asyncCssLinks(html: string): string {
  return html.replace(/<noscript\b[\s\S]*?<\/noscript>|<link\b[^>]*>/gi, (tag) =>
    isStylesheetLink(tag) ? `${preloadOf(tag)}<noscript>${tag}</noscript>` : tag,
  );
}
