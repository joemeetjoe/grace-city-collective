import type { LongformId, LongformSection, SiteContent } from "@/content/site";

/** a long-form section's content by its id; its shell is LONGFORM_SECTION (theme/classes.ts) */
export function sectionById(site: SiteContent, id: LongformId): LongformSection {
  const section = site.longform.find((s) => s.id === id);
  if (!section) throw new Error(`no long-form section "${id}" in the site content`);
  return section;
}
