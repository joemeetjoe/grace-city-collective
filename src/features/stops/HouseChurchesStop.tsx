import HouseTable from "./HouseTable";
import OrnamentSwitch from "./OrnamentSwitch";
import { chromeWords } from "@/content/site";
import { useSite } from "@/content/useSite";
import {
  ORNAMENT_IN_COLUMN,
  STOP_COLUMN,
  WORDS_BESIDE,
  ornamentColumn,
} from "@/theme/classes";
import Stop, { type StopProps } from "./Stop";
import StopWords from "./StopWords";
import { useStopPanel } from "./useStopPanel";

/**
 * The house churches stop: a single column of words to the right of the
 * crowd, but well in from the frame's edge, nearer the middle than the
 * who-we-are's left-hand column — no near figure reaches it at rest, it
 * only rises from behind them. Beside the words, its ornament, the
 * calendar's mirror: a house church at table in the G mark's box
 * (HouseTable), in a column past a divider (ornamentColumn), so the panel
 * runs wider than a column alone. Its seats are taken with the panel's
 * brackets and drawn in while the reader is over the panel, or its switch
 * is pressed (OrnamentSwitch) — or, below lg, while the stop is settled on
 * screen (useStopPanel) — seated under the words on a phone.
 */
export default function HouseChurchesStop({ section: s, ref }: StopProps) {
  const words = chromeWords(useSite());
  const { panel, hover, press, shown, lit } = useStopPanel();
  return (
    <Stop
      section={s}
      ref={ref}
      className="items-center justify-end lg:pr-[clamp(48px,11vw,200px)]"
      panel={panel}
      hover={hover}
      panelClassName="flex w-full max-w-[600px] flex-col lg:max-w-[840px] md:flex-row"
    >
      <div className={WORDS_BESIDE}>
        <StopWords
          stop="houses"
          kicker={s.kicker}
          heading={s.heading}
          body={s.body}
          reveal={STOP_COLUMN}
        />
      </div>
      <div className={ornamentColumn({ ornament: "table" })}>
        {/* a phone lays the table on its side under the words (the column is
            too tall a drawing there); from md it stands in its column */}
        <OrnamentSwitch label={words.table} {...press} className="w-full max-w-[300px] md:hidden">
          <HouseTable lit={lit} shown={shown} across className="block w-full" />
        </OrnamentSwitch>
        <OrnamentSwitch label={words.table} {...press} className={`hidden md:block ${ORNAMENT_IN_COLUMN}`}>
          <HouseTable lit={lit} shown={shown} className="block h-full w-full" />
        </OrnamentSwitch>
      </div>
    </Stop>
  );
}
