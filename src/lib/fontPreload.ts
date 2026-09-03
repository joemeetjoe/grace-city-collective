/**
 * The two latin font files the page paints above the fold — Geist for the
 * kicker and the nav, Cormorant Garamond for the headline — preloaded from
 * the head (#106). Discovered from the stylesheet alone they start only
 * once the css has arrived and been parsed; a preload starts them with the
 * first bytes of the page. The link is fetched anonymous-CORS, as every
 * font is, so the stylesheet's own request hits the same cache entry and
 * the file crosses the wire once.
 *
 * DOM-free, with no imports: vite.config.ts hands it the emitted files
 * (the gcc:font-preload plugin), under the node tsconfig.
 */

/** the stems of the files to preload, as @fontsource names them, in paint order */
export const PRELOAD_FONT_STEMS = ["cormorant-garamond-latin-400-normal", "geist-latin-wght-normal"] as const;

/** a preload link, as vite's transformIndexHtml accepts it (its HtmlTagDescriptor, without the import) */
export type FontPreloadTag = {
  tag: "link";
  attrs: { rel: "preload"; as: "font"; type: "font/woff2"; crossorigin: true; href: string };
  injectTo: "head";
};

/** the emitted file for a stem: `assets/<stem>-<hash>.woff2` */
const fileFor = (fileNames: readonly string[], stem: string): string => {
  const re = new RegExp(`(^|/)${stem}-[\\w-]+\\.woff2$`);
  const matches = fileNames.filter((f) => re.test(f));
  if (matches.length !== 1) {
    throw new Error(`expected one ${stem}-<hash>.woff2 in the build, found ${matches.length}: ${matches.join(", ")}`);
  }
  return matches[0];
};

/** the hrefs to preload, under the site's base, in PRELOAD_FONT_STEMS order */
export function fontPreloadHrefs(fileNames: readonly string[], base: string): string[] {
  const root = base.replace(/\/+$/, "");
  return PRELOAD_FONT_STEMS.map((stem) => `${root}/${fileFor(fileNames, stem)}`);
}

/** one `<link rel="preload" as="font" type="font/woff2" crossorigin>` per file */
export function fontPreloadTags(fileNames: readonly string[], base: string): FontPreloadTag[] {
  return fontPreloadHrefs(fileNames, base).map((href) => ({
    tag: "link",
    attrs: { rel: "preload", as: "font", type: "font/woff2", crossorigin: true, href },
    injectTo: "head",
  }));
}
