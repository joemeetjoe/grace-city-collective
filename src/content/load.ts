/**
 * Fetch the published `content/site.json` and hand back a `SiteContent`.
 *
 * Anything short of a valid document — network failure, non-2xx, bad JSON,
 * wrong shape — resolves to the built-in `site` so the page always has words.
 * A 404 just means nothing has been published yet, so it is logged at info;
 * every other failure warns with the reason, which for a shape problem is
 * the validator's path list.
 */

import { validateSite } from "./schema";
import { site, type SiteContent } from "./site";

export async function loadSiteContent(fetchImpl: typeof fetch, url: string): Promise<SiteContent> {
  let response: Response;
  try {
    // no-cache: revalidate with CloudFront on every load; the object carries
    // max-age=60 and is invalidated on publish, so this is the edge's copy
    response = await fetchImpl(url, { cache: "no-cache", headers: { accept: "application/json" } });
  } catch (error) {
    console.warn(`site content: fetch of ${url} failed (${String(error)}); using built-in content`);
    return site;
  }

  if (response.status === 404) {
    console.info(`site content: nothing published at ${url}; using built-in content`);
    return site;
  }
  if (!response.ok) {
    console.warn(`site content: ${url} responded ${response.status}; using built-in content`);
    return site;
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch (error) {
    console.warn(`site content: ${url} is not JSON (${String(error)}); using built-in content`);
    return site;
  }

  const result = validateSite(json);
  if (!result.ok) {
    console.warn(`site content: ${url} has the wrong shape; using built-in content\n  ${result.errors.join("\n  ")}`);
    return site;
  }
  return result.value;
}
