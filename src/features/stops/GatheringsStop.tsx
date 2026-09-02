import { useState } from "react";

import GatheringCalendar from "./GatheringCalendar";
import GatheringMark from "@/marks/GatheringMark";
import OrnamentSwitch from "./OrnamentSwitch";
import PanelReveal from "@/ui/panel/PanelReveal";
import {
  GATHERING_MARKS,
  chromeWords,
  type GatheringMark as Mark,
} from "@/content/site";
import { useSite } from "@/content/useSite";
import { PHONE_BODY, serif } from "@/theme/classes";
import { REVEAL_STAGGER_MS } from "@/theme/motion";
import Stop, { type StopProps } from "./Stop";
import StopWords from "./StopWords";
import { useStopPanel } from "./useStopPanel";

/**
 * The gatherings stop: the month's column beside the words, the emblems at
 * the cards' feet. Its ornament is a month of Sundays in the G mark's box
 * (GatheringCalendar), on the left of the panel in the column its tuck
 * clears for the figures, cascading in with the panel's brackets and lit
 * for the gathering under the pointer, a divider between it and the words.
 * The column exists only where the panel tucks; below lg the month lies
 * across under the headline instead, lit for whichever gathering's emblem
 * lit last as they light in turn (useStopPanel). Each gathering's emblem
 * (GatheringMark) traces in with the brackets at the foot of its column,
 * and gathers while the reader is over the gathering — or while its
 * emblem's switch is pressed (OrnamentSwitch, #130), which holds it.
 */
export default function GatheringsStop({ section: s, ref }: StopProps) {
  const site = useSite();
  const words = chromeWords(site);
  // the gathering under the pointer, and the one whose switch is pressed: either lights the tiles beside the headline
  const [over, setOver] = useState<Mark | null>(null);
  const [pressed, setPressed] = useState<Mark | null>(null);
  const lit = over ?? pressed;
  const { panel, shown, belowLg, inTurn } = useStopPanel(site.gatherings.length);
  // each gathering's mark; a gathering published before the marks existed
  // takes one by position. Below lg the emblems light in turn, and the
  // month across lights for the one that lit last — until a switch is
  // pressed (#130), which is the touch's way in and speaks for both
  const marks = site.gatherings.map(
    (g, i) => g.mark ?? GATHERING_MARKS[i % GATHERING_MARKS.length],
  );
  const litInTurn = inTurn > 0 ? (marks[inTurn - 1] ?? null) : null;
  return (
    <Stop
      section={s}
      ref={ref}
      className="items-center"
      panel={panel}
      // three cards stack on a phone, so they tighten up to fit one viewport
      panelClassName="flex w-full max-w-[1080px] flex-col lg:flex-row"
    >
      <div
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
      <div className="flex min-w-0 flex-1 flex-col gap-6 md:gap-11 lg:pl-[clamp(24px,2.4vw,40px)] short:lg:gap-7">
        {/* the kicker rises with the headline here, the month across under both */}
        <StopWords
          stop="gatherings"
          kicker={s.kicker}
          kickerRises
          heading={s.heading}
          reveal="flex flex-col gap-3 md:gap-4"
        />
        {/* below lg the month lies across under the headline, where the
            desktop's column would have no room */}
        <div className="my-1 lg:hidden">
          <GatheringCalendar
            lit={belowLg ? (pressed ?? litInTurn) : lit}
            shown={shown}
            across
            className="w-full max-w-[320px]"
          />
        </div>
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
                key={g.id}
                data-gathering={mark}
                onMouseEnter={() => setOver(mark)}
                onMouseLeave={() =>
                  setOver((was) => (was === mark ? null : was))
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
                <OrnamentSwitch
                  label={`${words.month}: ${g.title}`}
                  pressed={pressed === mark}
                  onPress={() => setPressed((was) => (was === mark ? null : mark))}
                  className="mx-auto mt-2 h-7 w-7 text-seal md:mt-auto md:h-11 md:w-11 md:pt-2 short:lg:h-9 short:lg:w-9"
                >
                  <GatheringMark
                    mark={mark}
                    shown={shown}
                    lit={belowLg ? i < inTurn || pressed === mark : lit === mark}
                    className="block h-full w-full"
                  />
                </OrnamentSwitch>
              </div>
            );
          })}
        </PanelReveal>
      </div>
    </Stop>
  );
}
