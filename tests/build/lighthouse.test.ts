import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

import { assertedKeys, lighthouseIds, unknownAssertionKeys, type LighthouseDefaultConfig } from "./lighthouseConfig";

// Lighthouse is a dependency of @lhci/cli, not of the repo, so it is reached
// the way lhci reaches it: from @lhci/cli's own node_modules. The default
// config is what `lhci collect` runs with when no settings override it.
const require = createRequire(import.meta.url);
const lhciRequire = createRequire(require.resolve("@lhci/cli/package.json"));
const defaultConfigPath = lhciRequire.resolve("lighthouse/core/config/default-config.js");

const profiles = ["mobile", "desktop"].map((name) => ({
  name,
  config: require(`../../tools/perf/lighthouserc.${name}.cjs`) as unknown,
}));

describe("tools/perf/lighthouserc.*.cjs", () => {
  it.each(profiles)("$name asserts something", ({ config }) => {
    expect(assertedKeys(config).length).toBeGreaterThan(0);
  });

  it.each(profiles)("$name asserts only audits and categories the installed Lighthouse has", async ({ config }) => {
    // a Lighthouse bump that renames or drops an audit would otherwise turn
    // the assertion into a silent "did not run"
    const { default: defaultConfig } = (await import(pathToFileURL(defaultConfigPath).href)) as {
      default: LighthouseDefaultConfig;
    };
    expect(unknownAssertionKeys(assertedKeys(config), lighthouseIds(defaultConfig))).toEqual([]);
  });
});
