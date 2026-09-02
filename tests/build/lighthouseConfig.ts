/**
 * The Lighthouse CI configs (tools/perf/lighthouserc.*.cjs) against the
 * installed Lighthouse: every asserted key must be an audit id or a
 * `categories:<id>` that Lighthouse's default config carries, or a version
 * bump could rename an audit and turn its assertion into a silent
 * "did not run" instead of a red check.
 */

/** what an lhci config looks like from here: `ci.assert.assertions` keyed by audit id or `categories:<id>` */
interface LhciConfigLike {
  ci?: { assert?: { assertions?: Record<string, unknown> } };
}

/** the parts of lighthouse/core/config/default-config.js read here */
export interface LighthouseDefaultConfig {
  /** audit module paths, or `{ path }` with options; the id is the path's basename */
  audits: Array<string | { path: string }>;
  categories: Record<string, unknown>;
}

/** the ids Lighthouse can report on */
export interface LighthouseIds {
  audits: string[];
  categories: string[];
}

const CATEGORY_PREFIX = "categories:";

/** every key in the config's assertions block, in order */
export function assertedKeys(config: unknown): string[] {
  const assertions = (config as LhciConfigLike)?.ci?.assert?.assertions;
  return assertions ? Object.keys(assertions) : [];
}

/**
 * the audit and category ids of a Lighthouse default config; an audit's id
 * is the basename of its module path (`metrics/speed-index` → `speed-index`)
 */
export function lighthouseIds(config: LighthouseDefaultConfig): LighthouseIds {
  const audits = config.audits.map((entry) => {
    const modulePath = typeof entry === "string" ? entry : entry.path;
    return modulePath.split("/").pop() ?? modulePath;
  });
  return { audits, categories: Object.keys(config.categories) };
}

/** the asserted keys that name no audit and no category Lighthouse has */
export function unknownAssertionKeys(keys: string[], ids: LighthouseIds): string[] {
  return keys.filter((key) =>
    key.startsWith(CATEGORY_PREFIX)
      ? !ids.categories.includes(key.slice(CATEGORY_PREFIX.length))
      : !ids.audits.includes(key),
  );
}
