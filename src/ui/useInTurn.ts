import { useMemo } from "react";

import { useWatch } from "./useWatch";
import { createWatch } from "./watch";

/**
 * How many of `count` things are on, when they come on one after the next:
 * none while `on` is false; with `on` true the first `delayMs` in and each
 * of the rest `stepMs` after the one before, until all are on; all off
 * together the moment `on` turns false. What lights a row of gathering
 * emblems in sequence on a phone, where a desktop lights the one under the
 * pointer. A count rather than the things themselves, so a caller's array
 * built each render cannot restart the sequence. A watch over timers
 * (watch.ts): any change of inputs is a fresh sequence from none.
 */
export function useInTurn(
  on: boolean,
  count: number,
  stepMs: number,
  delayMs = 0,
): number {
  const watch = useMemo(
    () =>
      createWatch(0, (set) => {
        if (!on) return () => {};
        const timers = Array.from({ length: count }, (_, i) =>
          setTimeout(() => set(i + 1), delayMs + i * stepMs),
        );
        return () => {
          for (const t of timers) clearTimeout(t);
        };
      }),
    [on, count, stepMs, delayMs],
  );
  return useWatch(watch);
}
