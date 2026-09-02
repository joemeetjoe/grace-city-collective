import { useContext, useState } from "react";

import HouseTable from "./HouseTable";
import SharedLife from "./SharedLife";
import Bracketed, { PanelShownContext } from "@/ui/panel/Bracketed";
import Kicker from "@/ui/panel/Kicker";
import PanelReveal from "@/ui/panel/PanelReveal";
import { TUCK, stopBody, stopFrame, stopHeading } from "@/theme/classes";
import type { StopProps } from "./Scene";
import { useStopPanel } from "./useStopPanel";

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
        className="block w-full max-w-[300px] md:hidden"
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
      className={`${ORNAMENT_COLUMN} lg:w-[max(clamp(120px,9vw,160px),calc(var(--tuck)_-_var(--spacing-panel-pad)))]`}
    >
      {/* a phone runs the dozen rows six and six, side by side (a single
          column runs too long under the words); from md the tall column */}
      <SharedLife
        lit={lit}
        shown={shown}
        columns={2}
        className="block w-full max-w-[300px] md:hidden"
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
 * The about and house-churches stops, one component: they share the
 * words-beside-ornament layout, the pointer-over lighting and the tuck
 * wiring; the per-stop differences (side placement, heading sizes, which
 * ornament) are the conditionals below.
 */
export default function AboutHousesStop({ section: s, ref }: StopProps) {
  // whether the reader is over the house churches' panel, seating its table,
  // or the who-we-are's, huddling its program
  const [over, setOver] = useState(false);
  const { panel, belowLg, playing } = useStopPanel();
  const { base, clear } = stopFrame(s.id);
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
          className={stopHeading({ stop: about ? "about" : "houses" })}
        >
          {s.heading}
        </h2>
        {s.body.map((p) => (
          <p
            key={p}
            className={stopBody({ stop: about ? "about" : "houses" })}
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
      ref={ref}
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
