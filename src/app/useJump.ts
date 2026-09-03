import { useMemo } from "react";

import { useSite } from "@/content/useSite";
import type { PageScroll } from "@/scroll/useSmoothScroll";
import { createJump, type JumpTo } from "./jump";

/** the nav's jump over the provided site content and the page's scroll; stable for the life of both */
export function useJump(scroll: PageScroll): JumpTo {
  const site = useSite();
  return useMemo(() => createJump(site, scroll), [site, scroll]);
}
