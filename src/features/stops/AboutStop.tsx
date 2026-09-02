import OrnamentSwitch from "./OrnamentSwitch";
import SharedLife from "./SharedLife";
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
 * The who-we-are stop: a single column of words left of the crowd, giving
 * up its right third to the two near apostles (TUCK), so its words set a
 * size smaller to keep the panel one screen tall; beside them, its
 * ornament — an order of service that huddles into a life shared
 * (SharedLife), in the column the tuck clears, past a divider
 * (ornamentColumn). Its rows print in with the panel's brackets and huddle
 * while the reader is over the panel, or its switch is pressed
 * (OrnamentSwitch) — or, below lg, while the stop is settled on screen
 * (useStopPanel) — seated under the words on a phone.
 */
export default function AboutStop({ section: s, ref }: StopProps) {
  const words = chromeWords(useSite());
  const { panel, hover, press, shown, lit } = useStopPanel();
  return (
    <Stop
      section={s}
      ref={ref}
      className="items-center"
      panel={panel}
      hover={hover}
      panelClassName="flex w-full max-w-[600px] flex-col md:flex-row"
    >
      <div className={WORDS_BESIDE}>
        <StopWords
          stop="about"
          kicker={s.kicker}
          heading={s.heading}
          body={s.body}
          reveal={STOP_COLUMN}
        />
      </div>
      <div className={ornamentColumn({ ornament: "life" })}>
        {/* a phone runs the dozen rows six and six, side by side (a single
            column runs too long under the words); from md the tall column */}
        <OrnamentSwitch label={words.life} {...press} className="w-full max-w-[300px] md:hidden">
          <SharedLife lit={lit} shown={shown} columns={2} className="block w-full" />
        </OrnamentSwitch>
        <OrnamentSwitch label={words.life} {...press} className={`hidden md:block ${ORNAMENT_IN_COLUMN}`}>
          <SharedLife lit={lit} shown={shown} className="block h-full w-full" />
        </OrnamentSwitch>
      </div>
    </Stop>
  );
}
