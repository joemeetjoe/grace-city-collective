import type { SectionId, SiteContent } from "@/content/site";

/** one entry of the dot rail: a section id and the name shown beside its dot */
export type SectionMarker = { id: SectionId; label: string };

/**
 * Every section of the page in scroll order — the scene stops, then the
 * long-form — each with a label. Derived from site.ts, so the rail can never
 * drift from the page: a section is named by its nav link where it has one,
 * the hero (which has none) by the site's name, and anything else by its own
 * label or kicker.
 */
export function sectionMarkers(content: SiteContent): SectionMarker[] {
  const nav = new Map(content.nav.map((n) => [n.id, n.label]));
  const scene = content.scene.map((s) => ({
    id: s.id,
    label: nav.get(s.id) ?? (s.id === "hero" ? content.name : s.label),
  }));
  const longform = content.longform.map((s) => ({ id: s.id, label: nav.get(s.id) ?? s.kicker }));
  return [...scene, ...longform];
}
