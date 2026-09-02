import { useMemo, useState } from "react";

import type { HoverHandlers } from "./Stop";

/**
 * Hover-to-light, once (#121): whether the reader's pointer is over a thing,
 * and the pair of handlers that say so — for a panel lit as a whole while
 * the pointer is over it (the house table seated, the program huddled, the
 * field reaped). The handlers are stable, so a panel that takes them never
 * re-renders for their sake.
 */
export function useHoverLit(): { over: boolean; hover: HoverHandlers } {
  const [over, setOver] = useState(false);
  const hover = useMemo<HoverHandlers>(
    () => ({ onMouseEnter: () => setOver(true), onMouseLeave: () => setOver(false) }),
    [],
  );
  return { over, hover };
}
