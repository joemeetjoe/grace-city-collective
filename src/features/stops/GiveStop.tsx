import SowingMark from "@/marks/SowingMark";
import { STOP_COLUMN } from "@/theme/classes";
import { chromeWords } from "@/content/site";
import { useSite } from "@/content/useSite";
import OrnamentSwitch from "./OrnamentSwitch";
import Stop, { type StopProps } from "./Stop";
import StopWords from "./StopWords";
import { useStopPanel } from "./useStopPanel";

/**
 * The give stop: centred words at a reading measure, and its ornament — a
 * field sown and reaped in the G mark's box (SowingMark), standing in the
 * band the panel pads on its left to keep its words centred under the hood
 * (TUCK). It cascades in with the panel's brackets and the harvest fills
 * while the reader is over the panel or its switch is pressed
 * (OrnamentSwitch). Below lg there is no band: the field
 * stands at the head of the panel over the words, a size that keeps its
 * tiles the calendar's, and fills while the stop is settled on screen
 * (useStopPanel).
 */
export default function GiveStop({ section: s, ref }: StopProps) {
  const words = chromeWords(useSite());
  const { panel, hover, press, shown, lit } = useStopPanel();
  return (
    <Stop
      section={s}
      ref={ref}
      className="flex-col items-center text-center justify-center lg:pt-[clamp(100px,13vh,130px)] lg:pb-[clamp(150px,20vh,190px)]"
      panel={panel}
      hover={hover}
      panelClassName={`${STOP_COLUMN} items-center`}
    >
      <div
        // on desktop it starts at the glass's padding and runs the width of
        // the house table's column (HouseChurchesStop), wider than the give
        // tuck alone: the words set narrower than the room the tuck leaves
        // them, so the field can borrow the slack and keep tiles the
        // calendar's size
        className="relative w-[clamp(120px,32vw,150px)] lg:absolute lg:top-1/2 lg:left-panel-pad lg:w-[clamp(140px,11.5vw,200px)] lg:-translate-y-1/2"
      >
        <OrnamentSwitch label={words.field} {...press} className="w-full">
          <SowingMark lit={lit} shown={shown} className="w-full" />
        </OrnamentSwitch>
      </div>
      <StopWords
        stop="give"
        kicker={s.kicker}
        kickerProps={{ centred: true }}
        heading={s.heading}
        body={s.body}
        cta={s.cta}
        reveal={`${STOP_COLUMN} items-center`}
      />
    </Stop>
  );
}
