import { useCallback, useEffect, useRef } from "react";

import type { SectionId } from "@/content/site";
import { hashFor, idFromHash, replaceHash, throttleLatest, type Throttled } from "@/scroll/hash";
import { useAppStore } from "@/state/appStore";
import { HASH_THROTTLE_MS } from "@/theme/motion";
import type { JumpTo } from "./jump";

/** the gestures by which the reader takes the scroll back from a jump in flight (the smoother kills its tween on the first) */
export const READER_GESTURES = ["wheel", "touchmove", "keydown"] as const;

/**
 * The location hash follows the page (#133), three ways, all by replaceState
 * — never an entry, so the back button leaves the page, to the section the
 * reader was on if they come forward again:
 *
 * - the nav's jumps: the jump handed back writes the target's hash at once
 *   (the top of the page, `ids[0]`, is the bare path) and then jumps. While
 *   the jump is in flight the sections it passes are not written; the
 *   flight ends when the target is the active section, or when the reader
 *   takes the scroll back (READER_GESTURES).
 * - scrolling by hand: the store's `activeId` (scroll/sectionWatch.ts) is
 *   written as it changes, throttled to HASH_THROTTLE_MS with the latest
 *   value trailing, and never while the splash is up.
 * - the hash arriving or changing under the page: a hash on arrival lands
 *   at once — after the splash has gone, when one plays — through the same
 *   jump (a long-form section's chunk loads first, jump.ts); a hash the
 *   reader types or comes back to (hashchange, which back and forward
 *   raise for a fragment) jumps as the nav does.
 */
export function useHashSync(jump: JumpTo, ids: readonly SectionId[]): JumpTo {
  const top = ids[0] ?? null;
  // the section a programmatic jump is bound for, until it lands
  const flight = useRef<SectionId | null>(null);
  const writer = useRef<Throttled<string> | null>(null);

  const go = useCallback<JumpTo>(
    (id, options) => {
      flight.current = useAppStore.getState().activeId === id ? null : id;
      // a write the throttle still holds would land over the target's
      writer.current?.cancel();
      replaceHash(hashFor(id, top ?? id));
      jump(id, options);
    },
    [jump, top],
  );

  // scrolling by hand: the active section, throttled, once the splash has gone
  useEffect(() => {
    const throttled = throttleLatest<string>((hash) => replaceHash(hash), HASH_THROTTLE_MS);
    writer.current = throttled;
    const unsubscribe = useAppStore.subscribe((state, previous) => {
      const id = state.activeId;
      if (id === previous.activeId || id == null || state.intro) return;
      if (flight.current) {
        if (id === flight.current) flight.current = null;
        return;
      }
      throttled.push(hashFor(id, top ?? id));
    });
    const takeBack = () => {
      flight.current = null;
    };
    for (const type of READER_GESTURES) window.addEventListener(type, takeBack, { passive: true });
    return () => {
      for (const type of READER_GESTURES) window.removeEventListener(type, takeBack);
      unsubscribe();
      throttled.cancel();
      writer.current = null;
    };
  }, [top]);

  // arriving with a hash: land there, after the splash when one plays
  useEffect(() => {
    const id = idFromHash(window.location.hash, ids) as SectionId | null;
    if (id == null || id === top) return;
    const land = () => go(id, { immediate: true });
    if (!useAppStore.getState().intro) {
      land();
      return;
    }
    const unsubscribe = useAppStore.subscribe((state) => {
      if (state.intro) return;
      unsubscribe();
      land();
    });
    return unsubscribe;
  }, [go, ids, top]);

  // the hash changed under the page: the reader typed one, or came back to one
  useEffect(() => {
    const onHashChange = () => {
      const id = idFromHash(window.location.hash, ids) as SectionId | null;
      if (id != null) go(id);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [go, ids]);

  return go;
}
