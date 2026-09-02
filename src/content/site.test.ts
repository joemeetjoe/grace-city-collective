import { describe, expect, it } from "vitest";

import { sectionIds, site, wayIn } from "./site";

/** a slug: lower-case words and digits, hyphenated */
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** every list in the content whose items carry an id */
const LISTS: Record<string, { id: string }[]> = {
  nav: site.nav,
  scene: site.scene,
  longform: site.longform,
  gatherings: site.gatherings,
  wayIn: wayIn(site),
  devotions: site.devotions,
  beliefPosture: site.beliefPosture,
  beliefs: site.beliefs,
  faq: site.faq,
  "messages.latest": site.messages.latest,
  socials: site.socials,
};

describe("site content", () => {
  it("every nav id resolves to a section id", () => {
    const ids = sectionIds(site);
    for (const item of site.nav) {
      expect(ids, `nav "${item.label}" → #${item.id}`).toContain(item.id);
    }
  });

  it("the nav lists its sections in page order, like the dot rail", () => {
    const ids = sectionIds(site);
    const navIds = site.nav.map((n) => n.id);
    expect(navIds).toEqual(ids.filter((id) => navIds.includes(id)));
  });

  it("gives every item of every list a slug of its own, unique within its list", () => {
    for (const [name, items] of Object.entries(LISTS)) {
      const ids = items.map((item) => item.id);
      for (const id of ids) expect(id, `${name}: "${id}"`).toMatch(SLUG);
      expect(new Set(ids).size, `${name} ids: ${ids.join(", ")}`).toBe(ids.length);
    }
  });
});
