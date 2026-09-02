import type { SiteContent } from "@/content/site";

/** a long-form section's content by id; its shell is LONGFORM_SECTION (theme/classes.ts) */
export function longform(site: SiteContent, id: string) {
  return site.longform.find((s) => s.id === id)!;
}
