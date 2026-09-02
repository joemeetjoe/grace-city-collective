import {
  lazy,
  startTransition,
  Suspense,
  useEffect,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from "react";

import { useSite } from "@/content/useSite";
import { refreshScrollPositions } from "@/scroll/refresh";
import type { SectionRegistry } from "@/scroll/sections";
import { useInViewOnce } from "@/ui/useInViewOnce";
import { loadLongform } from "./loadLongform";
import {
  isLongformMounted,
  isLongformRequested,
  LONGFORM_MARGIN,
  markLongformMounted,
  requestLongform,
  subscribeLongform,
} from "./longformRequest";
import { LONGFORM_SECTION, STACK } from "@/theme/classes";

/** the chunk's component (Longform.tsx), loaded once, on the first render that asks */
const Longform = lazy(loadLongform);

/**
 * Where the long-form sections stand until their words arrive: each is a
 * viewport tall, whatever the breakpoint. Nothing is measured — the chunk is
 * requested two viewports ahead of the reader (LONGFORM_MARGIN), so the swap
 * happens off screen and shifts nothing in view; the placeholder height only
 * keeps the page's scroll range in the right order of magnitude meanwhile. A
 * jump to a long-form section waits for the mount (longformRequest.ts), so it
 * never lands on a placeholder's guess.
 */
const PLACEHOLDER = "min-h-[100svh]";

/**
 * The long-form on the page: the four section elements, with their ids, are
 * always here — the nav, the dot rail, the active-section watch and the
 * smoother all hold on to them from the first render — and the words that
 * fill them come in the long-form chunk (#111), requested once the reader
 * is two viewports away, or by a nav jump. The swap is a transition, so the
 * sections keep their placeholder height (no fallback flashes them empty)
 * until the whole chunk is ready to commit at once.
 */
export type LongformGateProps = {
  /** the page's section registry: each long-form section mounts with its ref (scroll/sections.ts) */
  sections: SectionRegistry;
};

export default function LongformGate({ sections }: LongformGateProps) {
  const site = useSite();
  const [requested, setRequested] = useState(false);
  const mounted = useSyncExternalStore(subscribeLongform, isLongformMounted);

  // the store asks (a jump, or this component's own trigger below). A
  // transition, not a plain update: a suspended transition holds the
  // sections as they are, where a plain update would commit the fallbacks
  useEffect(() => {
    const ask = () => {
      if (isLongformRequested()) startTransition(() => setRequested(true));
    };
    ask();
    return subscribeLongform(ask);
  }, []);

  // the reader nears: two viewports below the fold, once
  const [ref, near] = useInViewOnce<HTMLDivElement>(0, true, LONGFORM_MARGIN);
  useEffect(() => {
    if (near) void requestLongform();
  }, [near]);

  // the transition commits only once the chunk has rendered: this is the
  // mount. The sections have just grown from their placeholder height, so
  // every ScrollTrigger measured against them (the active-section watch,
  // the smoother's scroll range) is re-read first; then the store's word
  // drops the placeholder height and lets a waiting jump land
  useLayoutEffect(() => {
    if (!requested) return;
    refreshScrollPositions();
    markLongformMounted();
  }, [requested]);

  return (
    <div ref={ref} data-longform="" className={`relative ${STACK.between} bg-ink`}>
      {site.longform.map((s) => (
        <section
          key={s.id}
          ref={sections.ref(s.id)}
          id={s.id}
          aria-busy={mounted ? undefined : true}
          className={mounted ? LONGFORM_SECTION : `${LONGFORM_SECTION} ${PLACEHOLDER}`}
        >
          <Suspense fallback={null}>{requested && <Longform part={s.id} />}</Suspense>
        </section>
      ))}
      <Suspense fallback={null}>{requested && <Longform part="footer" />}</Suspense>
    </div>
  );
}
