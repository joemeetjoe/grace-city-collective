import { describe, expect, it } from "vitest";

import { sectionIds, site } from "./site";

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

  it("the scene is the six stops, in order", () => {
    expect(site.scene.map((s) => s.label)).toEqual([
      "Hero",
      "Who we are",
      "House churches",
      "Gatherings",
      "Give",
      "Visit",
    ]);
  });
});
