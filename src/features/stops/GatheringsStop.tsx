import { useContext, useState } from "react";

import GatheringCalendar from "./GatheringCalendar";
import GatheringMark from "@/marks/GatheringMark";
import Bracketed, { PanelShownContext } from "@/ui/panel/Bracketed";
import Kicker from "@/ui/panel/Kicker";
import PanelReveal from "@/ui/panel/PanelReveal";
import {
  GATHERING_MARKS,
  type GatheringMark as Mark,
} from "@/content/site";
import { useSite } from "@/content/useSite";
import { PHONE_BODY, TUCK, serif, stopFrame, stopHeading } from "@/theme/classes";
import { REVEAL_STAGGER_MS } from "@/theme/motion";
import type { StopProps } from "./Scene";
import { useStopPanel } from "./useStopPanel";

/**
 * The gatherings' ornament: a month of Sundays in the G mark's box, on the
 * left of the panel in the column its tuck clears for the figures, cascading
 * in with the panel's brackets and lit for the gathering under the pointer
 * (GatheringCalendar). A divider stands between it and the words. The
 * column exists only where the panel tucks; below lg the month lies across
 * under the headline instead (`across`), lit for whichever gathering's
 * emblem (GatheringEmblem) lit last as they light in turn (Scene).
 */
/**
 * A gathering's emblem at the foot of its column (GatheringMark): its
 * lozenges trace in with the panel's brackets, and gather while the reader
 * is over the gathering.
 */
function GatheringEmblem({ mark, lit }: { mark: Mark; lit: boolean }) {
  const shown = useContext(PanelShownContext);
  return (
    <GatheringMark
      mark={mark}
      shown={shown}
      lit={lit}
      className="mx-auto mt-2 h-7 w-7 text-seal md:mt-auto md:h-11 md:w-11 md:pt-2 short:lg:h-9 short:lg:w-9"
    />
  );
}

function GatheringsCalendar({
  lit,
  across = false,
}: {
  lit: Mark | null;
  across?: boolean;
}) {
  const shown = useContext(PanelShownContext);
  if (across) {
    return (
      <div data-gatherings-calendar="" className="my-1 lg:hidden">
        <GatheringCalendar
          lit={lit}
          shown={shown}
          across
          className="w-full max-w-[320px]"
        />
      </div>
    );
  }
  return (
    <div
      data-gatherings-calendar=""
      // its width is the tuck less the panel's padding (Bracketed), so the
      // words start where the tuck put them; Tailwind reads classes literally.
      // The month is absolutely placed inside, so it fills the column's height
      // (set by the words beside it) without ever adding to it
      className="relative hidden shrink-0 border-r border-cream/25 pr-[clamp(20px,2vw,32px)] lg:block lg:w-[calc(var(--tuck)_-_var(--spacing-panel-pad))]"
    >
      <GatheringCalendar
        lit={lit}
        shown={shown}
        className="absolute inset-y-1 left-0 h-[calc(100%_-_8px)] w-[calc(100%_-_clamp(20px,2vw,32px))]"
      />
    </div>
  );
}

/** the gatherings stop: the month's column beside the words, the emblems at the cards' feet */
export default function GatheringsStop({ section: s, ref }: StopProps) {
  const site = useSite();
  // the gathering under the pointer, lighting the tiles beside the headline
  const [lit, setLit] = useState<Mark | null>(null);
  const { panel, belowLg, inTurn } = useStopPanel(site.gatherings.length);
  const { base, clear } = stopFrame(s.id);
  // each gathering's mark; a gathering published before the marks existed
  // takes one by position. Below lg the emblems light in turn, and the
  // month across lights for the one that lit last
  const marks = site.gatherings.map(
    (g, i) => g.mark ?? GATHERING_MARKS[i % GATHERING_MARKS.length],
  );
  const litInTurn = inTurn > 0 ? (marks[inTurn - 1] ?? null) : null;
  return (
    <section
      ref={ref}
      id={s.id}
      data-screen-label={s.label}
      className={`${base} ${clear} items-center`}
    >
      {/* three cards stack on a phone, so they tighten up to fit one viewport */}
      <Bracketed
        {...panel}
        className={`flex w-full max-w-[1080px] flex-col lg:flex-row ${TUCK[s.id]}`}
      >
        <GatheringsCalendar lit={lit} />
        <div className="flex min-w-0 flex-1 flex-col gap-6 md:gap-11 lg:pl-[clamp(24px,2.4vw,40px)] short:lg:gap-7">
          <PanelReveal className="flex flex-col gap-3 md:gap-4">
            <Kicker>{s.kicker}</Kicker>
            <h2
              className={stopHeading({ stop: "gatherings" })}
            >
              {s.heading}
            </h2>
          </PanelReveal>
          {/* below lg the month lies across under the headline, where the
            desktop's column would have no room */}
          <GatheringsCalendar across lit={belowLg ? litInTurn : lit} />
          {/* two gatherings side by side, each closed by its lozenge mark,
            centred under the words and pushed to the card's foot so the two
            marks sit level across the columns. The whole block steps
            down a size on a short desktop viewport (see TUCK) */}
          <PanelReveal
            delay={REVEAL_STAGGER_MS * 2}
            className="grid gap-5 md:grid-cols-2 md:gap-x-12 md:gap-y-8"
          >
            {site.gatherings.map((g, i) => {
              const mark = marks[i];
              return (
                <div
                  key={g.title}
                  data-gathering={mark}
                  onMouseEnter={() => setLit(mark)}
                  onMouseLeave={() =>
                    setLit((was) => (was === mark ? null : was))
                  }
                  className="rule-draw flex flex-col gap-2 pt-4 md:gap-4 md:pt-7 short:lg:gap-3 short:lg:pt-5"
                >
                  <h3
                    className={`text-[24px] leading-[1.12] md:text-[34px] short:lg:text-[27px] ${serif}`}
                  >
                    {g.title}
                  </h3>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-seal md:text-xs">
                    {g.when}
                  </p>
                  <p className={`text-[15px] leading-[1.5] text-pretty text-cream/75 md:text-lg md:leading-relaxed short:lg:text-base ${PHONE_BODY}`}>
                    {g.body}
                  </p>
                  <GatheringEmblem
                    mark={mark}
                    lit={belowLg ? i < inTurn : lit === mark}
                  />
                </div>
              );
            })}
          </PanelReveal>
        </div>
      </Bracketed>
    </section>
  );
}
