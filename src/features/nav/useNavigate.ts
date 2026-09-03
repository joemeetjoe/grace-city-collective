import { useMemo, type MouseEvent } from "react";

import { useJumpTo } from "@/app/useJumpTo";
import type { SectionId } from "@/content/site";

/** a link's click handler for `#id`: it keeps the browser off the hash and jumps there instead */
export type Navigate = (id: SectionId) => (e: MouseEvent<HTMLAnchorElement>) => void;

/**
 * The one way a nav link navigates: every `<a href="#id">` in the site nav,
 * the dot rail and the mobile sheet takes `navigate(id)` as its onClick, so
 * no link is ever rendered without a working handler. The handler owns the
 * preventDefault and the jump the app provided (app/useJumpTo.ts); a
 * caller with a step of its own
 * first — the sheet closing — wraps it.
 */
export function useNavigate(): Navigate {
  const jumpTo = useJumpTo();
  return useMemo(
    () => (id) => (e) => {
      e.preventDefault();
      jumpTo(id);
    },
    [jumpTo],
  );
}
