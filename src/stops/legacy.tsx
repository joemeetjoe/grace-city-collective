import { useContext, useState } from "react";

import GatheringCalendar from "@/components/GatheringCalendar";
import GatheringMark from "@/components/GatheringMark";
import HouseTable from "@/components/HouseTable";
import SharedLife from "@/components/SharedLife";
import Bracketed, { PanelShownContext } from "@/components/panel/Bracketed";
import Kicker from "@/components/panel/Kicker";
import PanelReveal from "@/components/panel/PanelReveal";
import { REVEAL_STAGGER_MS } from "@/components/Reveal";
import {
  GATHERING_MARKS,
  type GatheringMark as Mark,
  type SceneSection,
} from "@/content/site";
import { useSite } from "@/content/useSite";
import { serif } from "@/app/styles";
import { PHONE_BODY, TUCK, stopFrame } from "@/stops/tuck";
import { useStopPanel } from "@/stops/useStopPanel";

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
      className="mx-auto mt-2 h-7 w-7 text-seal md:mt-auto md:h-11 md:w-11 md:pt-2 [@media(max-height:820px)]:lg:h-9 [@media(max-height:820px)]:lg:w-9"
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
      className="relative hidden shrink-0 border-r border-cream/25 pr-[clamp(20px,2vw,32px)] lg:block lg:w-[calc(var(--tuck)_-_clamp(18px,2.6vw,32px))]"
    >
      <GatheringCalendar
        lit={lit}
        shown={shown}
        className="absolute inset-y-1 left-0 h-[calc(100%_-_8px)] w-[calc(100%_-_clamp(20px,2vw,32px))]"
      />
    </div>
  );
}

/**
 * Where a stop's column ornament sits (HouseChurchesTable, AboutSharedLife):
 * from md up in a column on the right of the words past a divider, the
 * drawing absolutely placed inside so it fills the column's height (set by
 * the words beside it) without ever adding to it; on a phone, where the
 * words need the whole width, under them at the panel's left, its own
 * height. The desktop column's width is each ornament's own.
 */
const ORNAMENT_COLUMN =
  "relative mt-5 shrink-0 md:mt-0 md:w-[clamp(72px,20vw,120px)] md:border-l md:border-cream/25 md:pl-[clamp(20px,2vw,32px)]";
const ORNAMENT_IN_COLUMN =
  "w-[clamp(72px,20vw,120px)] md:absolute md:inset-y-1 md:right-0 md:h-[calc(100%_-_8px)] md:w-[calc(100%_-_clamp(20px,2vw,32px))]";

/**
 * The house churches' ornament, the calendar's mirror: a house church at
 * table in the G mark's box (HouseTable), on the right of the panel past a
 * divider, its seats taken with the panel's brackets and drawn in while
 * the reader is over the panel — or, below lg, while the stop is settled
 * on screen (Scene), seated under the words on a phone (ORNAMENT_COLUMN).
 */
function HouseChurchesTable({ lit }: { lit: boolean }) {
  const shown = useContext(PanelShownContext);
  return (
    <div
      data-house-churches-table=""
      className={`${ORNAMENT_COLUMN} lg:w-[clamp(150px,12vw,200px)]`}
    >
      {/* a phone lays the table on its side under the words (the column is
          too tall a drawing there); from md it stands in its column */}
      <HouseTable
        lit={lit}
        shown={shown}
        across
        className="w-full max-w-[300px] md:hidden"
      />
      <HouseTable
        lit={lit}
        shown={shown}
        className={`hidden md:block ${ORNAMENT_IN_COLUMN}`}
      />
    </div>
  );
}

/**
 * The who-we-are's ornament: an order of service that huddles into a life
 * shared (SharedLife), on the right of the panel past a divider, in the
 * column its tuck clears for the two near apostles — never narrower than
 * the house table's column, so on a wide screen where the tuck is slight
 * the words give up the room instead. Its rows print in with the panel's
 * brackets and huddle while the reader is over the panel — or, below lg,
 * while the stop is settled on screen (Scene), seated under the words on
 * a phone (ORNAMENT_COLUMN).
 */
function AboutSharedLife({ lit }: { lit: boolean }) {
  const shown = useContext(PanelShownContext);
  return (
    <div
      data-about-shared-life=""
      className={`${ORNAMENT_COLUMN} lg:w-[max(clamp(120px,9vw,160px),calc(var(--tuck)_-_clamp(18px,2.6vw,32px)))]`}
    >
      {/* a phone runs the dozen rows six and six, side by side (a single
          column runs too long under the words); from md the tall column */}
      <SharedLife
        lit={lit}
        shown={shown}
        columns={2}
        className="w-full max-w-[300px] md:hidden"
      />
      <SharedLife
        lit={lit}
        shown={shown}
        className={`hidden md:block ${ORNAMENT_IN_COLUMN}`}
      />
    </div>
  );
}

/**
 * The stops not yet migrated to their own components (#79, #81): the
 * gatherings and about/house-churches branches of the old Scene, moved
 * verbatim. The dispatcher (Scene.tsx) falls through to this
 * until each stop moves out.
 */
export default function LegacyStop({ section: s }: { section: SceneSection }) {
  const site = useSite();
  // the gathering under the pointer, lighting the tiles beside the headline
  const [lit, setLit] = useState<Mark | null>(null);
  // whether the reader is over the house churches' panel, seating its table,
  // or the who-we-are's, huddling its program
  const [over, setOver] = useState(false);
  const { panel, belowLg, playing, inTurn } = useStopPanel(
    site.gatherings.length,
  );
  const { base, clear } = stopFrame(s.id);
  if (s.id === "gatherings") {
    // each gathering's mark; a gathering published before the marks existed
    // takes one by position. Below lg the emblems light in turn, and the
    // month across lights for the one that lit last
    const marks = site.gatherings.map(
      (g, i) => g.mark ?? GATHERING_MARKS[i % GATHERING_MARKS.length],
    );
    const litInTurn = inTurn > 0 ? (marks[inTurn - 1] ?? null) : null;
    return (
      <section
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
          <div className="flex min-w-0 flex-1 flex-col gap-6 md:gap-11 lg:pl-[clamp(24px,2.4vw,40px)] [@media(max-height:820px)]:lg:gap-7">
            <PanelReveal className="flex flex-col gap-3 md:gap-4">
              <Kicker>{s.kicker}</Kicker>
              <h2
                className={`text-[clamp(30px,3.4vw,48px)] leading-[1.06] text-balance [@media(max-height:820px)]:lg:text-[36px] ${serif}`}
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
                    className="rule-draw flex flex-col gap-2 pt-4 md:gap-4 md:pt-7 [@media(max-height:820px)]:lg:gap-3 [@media(max-height:820px)]:lg:pt-5"
                  >
                    <h3
                      className={`text-[24px] leading-[1.12] md:text-[34px] [@media(max-height:820px)]:lg:text-[27px] ${serif}`}
                    >
                      {g.title}
                    </h3>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-seal md:text-xs">
                      {g.when}
                    </p>
                    <p className={`text-[15px] leading-[1.5] text-pretty text-cream/75 md:text-lg md:leading-relaxed [@media(max-height:820px)]:lg:text-base ${PHONE_BODY}`}>
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
  // about and house churches: a single column, left or right of the crowd
  // house churches sits to the right of the crowd, but well in from the
  // frame's edge, nearer the middle than the about stop's left-hand column;
  // no near figure reaches it at rest — it only rises from behind them
  const side =
    s.id === "house-churches"
      ? "justify-end lg:pr-[clamp(48px,11vw,200px)]"
      : "";
  // the who-we-are column gives up its right third to the two near apostles
  // (TUCK), so its words set a size smaller to keep the panel one screen tall
  const about = s.id === "about";
  // house churches seats its table in a column on the right of the words,
  // the calendar's mirror, so its panel runs wider than a column alone
  const houses = s.id === "house-churches";
  // both seat an ornament in a column beside the words, lit while the reader is over the panel
  const beside = about || houses;
  const words = (
    <>
      <Kicker>{s.kicker}</Kicker>
      <PanelReveal className="flex flex-col gap-5 md:gap-[26px]">
        <h2
          className={`${about ? "text-[clamp(30px,2.8vw,48px)] [@media(max-height:820px)]:lg:text-[36px]" : "text-[clamp(34px,4.1vw,58px)]"} leading-[1.06] text-balance ${serif}`}
        >
          {s.heading}
        </h2>
        {s.body.map((p) => (
          <p
            key={p}
            className={`text-base leading-relaxed text-pretty text-cream/80 ${about ? "[@media(max-height:820px)]:lg:text-[14px]" : "md:text-lg"} ${PHONE_BODY}`}
          >
            {p}
          </p>
        ))}
      </PanelReveal>
    </>
  );
  const column = "flex flex-col gap-5 md:gap-[26px]";
  return (
    <section
      id={s.id}
      data-screen-label={s.label}
      className={`${base} ${clear} items-center ${side}`}
    >
      <Bracketed
        {...panel}
        className={
          beside
            ? `flex w-full max-w-[600px] flex-col ${houses ? "lg:max-w-[840px]" : ""} md:flex-row ${TUCK[s.id] ?? ""}`
            : `${column} max-w-[600px] ${TUCK[s.id] ?? ""}`
        }
        onMouseEnter={beside ? () => setOver(true) : undefined}
        onMouseLeave={beside ? () => setOver(false) : undefined}
      >
        {beside ? (
          <>
            <div
              className={`${column} min-w-0 flex-1 md:pr-[clamp(24px,2.4vw,40px)]`}
            >
              {words}
            </div>
            {houses ? (
              <HouseChurchesTable lit={belowLg ? playing : over} />
            ) : (
              <AboutSharedLife lit={belowLg ? playing : over} />
            )}
          </>
        ) : (
          words
        )}
      </Bracketed>
    </section>
  );
}
