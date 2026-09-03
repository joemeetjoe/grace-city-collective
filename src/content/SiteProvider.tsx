import type { ReactNode } from "react";

import { site, type SiteContent } from "./site";
import { SiteContext } from "./siteContext";

/** the root's provider of the site's words (main.tsx); the built-in content unless another is given */
export function SiteProvider({ content = site, children }: { content?: SiteContent; children: ReactNode }) {
  return <SiteContext.Provider value={content}>{children}</SiteContext.Provider>;
}
