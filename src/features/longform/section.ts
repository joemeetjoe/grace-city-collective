import { gutter } from "@/app/styles";
import type { SiteContent } from "@/content/site";

/** the shell every long-form section wears: the page gutter and the tall vertical rhythm */
export const LONGFORM_SECTION = `scroll-mt-24 ${gutter} py-[clamp(56px,9vh,140px)] md:py-[clamp(80px,12vh,140px)]`;

export function longform(site: SiteContent, id: string) {
  return site.longform.find((s) => s.id === id)!;
}
