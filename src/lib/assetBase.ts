/**
 * Resolve a `public/` asset against the path the site is served from.
 *
 * Vite bakes `base` into `import.meta.env.BASE_URL` — `/` in dev and on a
 * custom domain, `/grace-city-collective/` on GitHub Pages — but only rewrites
 * the URLs it can see at build time. Anything requested at runtime (the Doré
 * cuts, textures) has to be prefixed by hand, or every one of them 404s on
 * Pages.
 */
export function assetUrl(path: string, base: string = import.meta.env.BASE_URL): string {
  const root = base.replace(/\/+$/, "");
  const rel = path.replace(/^\/+/, "").replace(/\/+$/, "");
  return `${root}/${rel}`;
}
