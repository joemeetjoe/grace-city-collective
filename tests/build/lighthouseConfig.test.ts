import { describe, expect, it } from "vitest";

import { assertedKeys, unknownAssertionKeys } from "./lighthouseConfig";

const known = {
  audits: ["cumulative-layout-shift", "largest-contentful-paint"],
  categories: ["performance", "accessibility"],
};

describe("assertedKeys", () => {
  it("lists every key of the assertions block", () => {
    const config = { ci: { assert: { assertions: { "categories:seo": "error", "speed-index": ["warn", {}] } } } };
    expect(assertedKeys(config)).toEqual(["categories:seo", "speed-index"]);
  });

  it("is empty for a config that asserts nothing", () => {
    expect(assertedKeys({ ci: { collect: {} } })).toEqual([]);
  });
});

describe("unknownAssertionKeys", () => {
  it("reports a misspelled audit id", () => {
    expect(unknownAssertionKeys(["cumulative-layout-shfit"], known)).toEqual(["cumulative-layout-shfit"]);
  });

  it("reports a category Lighthouse does not have", () => {
    expect(unknownAssertionKeys(["categories:pwa"], known)).toEqual(["categories:pwa"]);
  });

  it("is empty when every audit and category exists", () => {
    expect(unknownAssertionKeys(["categories:accessibility", "largest-contentful-paint"], known)).toEqual([]);
  });

  it("does not take a category id for an audit id", () => {
    expect(unknownAssertionKeys(["performance"], known)).toEqual(["performance"]);
  });
});
