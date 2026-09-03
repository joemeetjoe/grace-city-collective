import type { MouseEvent } from "react";

import { site } from "@/content/site";
import { isLongformMounted, requestLongform } from "@/features/longform/longformRequest";
import { jumpTo as scrollJumpTo } from "@/scroll/jump";
import { getScrollDriver } from "@/scroll/position";

/** the sections whose words arrive in the long-form chunk (#111) */
const longformIds = new Set<string>(site.longform.map((s) => s.id));

/**
 * The nav's jump to `#id`. A scene stop is on the page from the first render
 * and the jump goes at once; a long-form section's words come in their own
 * chunk, so the jump asks for it and lands once it has mounted — its box is
 * then its full height, not the placeholder's — unless it already has.
 */
export function jumpTo(id: string) {
  if (longformIds.has(id) && !isLongformMounted()) {
    void requestLongform().then(() => scrollJumpTo(id, getScrollDriver()));
    return;
  }
  // through the smoother when one is running, native smooth scroll otherwise
  scrollJumpTo(id, getScrollDriver());
}

export function jump(e: MouseEvent<HTMLAnchorElement>, id: string) {
  e.preventDefault();
  jumpTo(id);
}
