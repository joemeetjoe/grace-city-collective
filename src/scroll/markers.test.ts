import { describe, expect, it } from "vitest";

import { site, type SiteContent } from "@/content/site";

import { sectionMarkers } from "./markers";

describe("sectionMarkers", () => {
  it("labels a section by its nav link where it has one", () => {
    const byId = new Map(sectionMarkers(site).map((m) => [m.id, m.label]));
    for (const n of site.nav) expect(byId.get(n.id), n.id).toBe(n.label);
  });

  it("the hero, which has no nav link, is labelled with the site's name", () => {
    expect(sectionMarkers(site)[0]).toEqual({ id: "hero", label: site.name });
  });

  it("a section with no nav link falls back to its own label or kicker", () => {
    const content: SiteContent = {
      ...site,
      nav: [],
      scene: [site.scene[0], { ...site.scene[1], id: "about", label: "Who we are" }],
      longform: [{ id: "faq", kicker: "FAQ", heading: "Questions" }],
    };
    expect(sectionMarkers(content).map((m) => m.label)).toEqual([site.name, "Who we are", "FAQ"]);
  });
});
