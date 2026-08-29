import { describe, expect, it } from "vitest";

import { validateSite } from "./schema";
import { site } from "./site";

/** a deep copy of the built-in content to mutate in tests */
function clone(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(site));
}

describe("validateSite", () => {
  it("accepts the built-in content unchanged", () => {
    const result = validateSite(clone());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(site);
  });

  it("names the path of a wrong type", () => {
    const bad = clone();
    (bad.scene as Record<string, unknown>[])[2].heading = 42;
    const result = validateSite(bad);
    expect(result).toEqual({ ok: false, errors: ["scene[2].heading: expected string"] });
  });

  it("names a missing key", () => {
    const bad = clone();
    delete (bad.contact as { email?: string }).email;
    const result = validateSite(bad);
    expect(result).toEqual({ ok: false, errors: ["contact.email: missing, expected string"] });
  });

  it("rejects an unknown top-level key", () => {
    const bad = clone();
    bad.banner = "hi";
    const result = validateSite(bad);
    expect(result).toEqual({ ok: false, errors: ['unknown key "banner"'] });
  });

  it("rejects an unknown nested key", () => {
    const bad = clone();
    (bad.contact as Record<string, unknown>).fax = "none";
    expect(validateSite(bad)).toEqual({ ok: false, errors: ['contact: unknown key "fax"'] });
  });

  it("checks arrays of records element by element", () => {
    const bad = clone();
    (bad.faq as unknown[])[1] = { question: "only" };
    expect(validateSite(bad)).toEqual({ ok: false, errors: ["faq[1].answer: missing, expected string"] });
  });

  it("checks arrays of strings", () => {
    const bad = clone();
    (bad.scene as { body: unknown[] }[])[1].body[0] = null;
    expect(validateSite(bad)).toEqual({ ok: false, errors: ["scene[1].body[0]: expected string"] });
  });

  it("keeps section ids to the known set", () => {
    const bad = clone();
    (bad.nav as { id: string }[])[0].id = "blog";
    const result = validateSite(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/^nav\[0\]\.id: expected one of /);
  });

  it("allows optional keys to be absent but not wrong", () => {
    const good = clone();
    delete (good.scene as { kicker?: string }[])[0].kicker;
    expect(validateSite(good).ok).toBe(true);

    const bad = clone();
    (bad.scene as { cta?: unknown }[])[4].cta = "give";
    expect(validateSite(bad)).toEqual({ ok: false, errors: ["scene[4].cta: expected object"] });
  });

  it("collects every error, not just the first", () => {
    const bad = clone();
    bad.name = 1;
    (bad.footer as Record<string, unknown>).copyright = [];
    const result = validateSite(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toEqual(["name: expected string", "footer.copyright: expected string"]);
  });

  it("rejects non-objects at the root", () => {
    expect(validateSite(null)).toEqual({ ok: false, errors: ["expected object"] });
    expect(validateSite([])).toEqual({ ok: false, errors: ["expected object"] });
  });
});

describe("validateSite — the way in", () => {
  it("accepts content published before the way in existed, and the site falls back to its own", async () => {
    const { wayIn } = await import("./site");
    const old = clone();
    delete old.wayIn;
    const result = validateSite(old);
    expect(result.ok).toBe(true);
    if (result.ok) expect(wayIn(result.value)).toEqual(site.wayIn);
  });

  it("checks a published way in step by step", () => {
    const bad = clone();
    (bad.wayIn as Record<string, unknown>[])[1] = { title: "Dinner." };
    expect(validateSite(bad)).toEqual({ ok: false, errors: ["wayIn[1].body: missing, expected string"] });
  });
});
