import { useMemo, type MouseEvent } from "react";

import type { SiteContent } from "@/content/site";
import { useSite } from "@/content/useSite";
import { isLongformMounted, requestLongform } from "@/features/longform/longformRequest";
import { jumpTo as scrollJumpTo } from "@/scroll/jump";
import { getScrollDriver } from "@/scroll/position";

export type Jump = {
  /**
   * The nav's jump to `#id`. A scene stop is on the page from the first render
   * and the jump goes at once; a long-form section's words come in their own
   * chunk, so the jump asks for it and lands once it has mounted — its box is
   * then its full height, not the placeholder's — unless it already has.
   */
  jumpTo: (id: string) => void;
  /** the same, from a link's click */
  jump: (e: MouseEvent<HTMLAnchorElement>, id: string) => void;
};

/** the nav's jumps over `site`: which ids wait for the long-form chunk (#111) */
export function createJump(site: SiteContent): Jump {
  const longformIds = new Set<string>(site.longform.map((s) => s.id));
  const jumpTo = (id: string) => {
    if (longformIds.has(id) && !isLongformMounted()) {
      void requestLongform().then(() => scrollJumpTo(id, getScrollDriver()));
      return;
    }
    // through the smoother when one is running, native smooth scroll otherwise
    scrollJumpTo(id, getScrollDriver());
  };
  return {
    jumpTo,
    jump: (e, id) => {
      e.preventDefault();
      jumpTo(id);
    },
  };
}

/** the nav's jumps over the provided site content; stable for the life of the content */
export function useJump(): Jump {
  const site = useSite();
  return useMemo(() => createJump(site), [site]);
}
