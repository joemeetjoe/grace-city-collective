import { useMemo } from "react";

import type { SectionId, SiteContent } from "@/content/site";
import { useSite } from "@/content/useSite";
import { isLongformMounted, requestLongform } from "@/features/longform/longformRequest";
import { jumpTo as scrollJumpTo } from "@/scroll/jump";
import type { PageScroll } from "@/scroll/useSmoothScroll";

/**
 * The nav's jump to `#id`. A scene stop is on the page from the first render
 * and the jump goes at once; a long-form section's words come in their own
 * chunk, so the jump asks for it and lands once it has mounted — its box is
 * then its full height, not the placeholder's — unless it already has.
 * The app provides it to the nav (jumpContext.tsx), and a link's click
 * reaches it through features/nav/useNavigate.ts.
 */
export type JumpTo = (id: SectionId) => void;

/** the nav's jump over `site`, through `scroll`'s driver: which ids wait for the long-form chunk (#111) */
export function createJump(site: SiteContent, scroll: Pick<PageScroll, "driver">): JumpTo {
  const longformIds = new Set<SectionId>(site.longform.map((s) => s.id));
  return (id) => {
    if (longformIds.has(id) && !isLongformMounted()) {
      void requestLongform().then(() => scrollJumpTo(id, scroll.driver()));
      return;
    }
    // through the smoother when one is running, native smooth scroll otherwise
    scrollJumpTo(id, scroll.driver());
  };
}

/** the nav's jump over the provided site content and the page's scroll; stable for the life of both */
export function useJump(scroll: PageScroll): JumpTo {
  const site = useSite();
  return useMemo(() => createJump(site, scroll), [site, scroll]);
}
