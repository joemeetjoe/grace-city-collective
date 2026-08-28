import { useContext } from "react";

import { SiteContext } from "./siteContext";
import type { SiteContent } from "./site";

export function useSite(): SiteContent {
  return useContext(SiteContext);
}
