import type { MouseEvent } from "react";

import { jumpTo as scrollJumpTo } from "@/scroll/jump";
import { getScrollDriver } from "@/scroll/position";

export function jumpTo(id: string) {
  // through the smoother when one is running, native smooth scroll otherwise
  scrollJumpTo(id, getScrollDriver());
}

export function jump(e: MouseEvent<HTMLAnchorElement>, id: string) {
  e.preventDefault();
  jumpTo(id);
}
