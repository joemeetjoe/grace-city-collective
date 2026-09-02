import Kicker from "@/ui/panel/Kicker";
import PanelReveal from "@/ui/panel/PanelReveal";
import SmoothHeight from "@/ui/SmoothHeight";
import { WAY_RISE } from "@/theme/classes";
import WayIn from "./WayIn";
import { wayIn, wayInWords } from "@/content/site";
import { useSite } from "@/content/useSite";
import Stop, { type StopProps } from "./Stop";
import StopWords from "./StopWords";
import { useStopPanel } from "./useStopPanel";
import { useWayStep } from "./useWayStep";

/**
 * The visit stop: the dove hangs in the upper third of the frame; the panel
 * sits under it, and fills the frame's width up to a reading measure. Its
 * headline and body are the current step's of the way in — five steps from
 * a first hello to a house church of one's own (WayIn), drawn in with the
 * panel's brackets at the panel's foot; the reader walks them by the
 * diamond arrows, and the words rise in each time the traveller lands.
 * Below lg (`single`) the current step stands alone between the arrows,
 * and the next slides in when one is pressed.
 */
export default function VisitStop({ section: s, ref }: StopProps) {
  const site = useSite();
  // the step of the way in the reader stands on, and which way it last walked
  const [way, onStep] = useWayStep();
  const { panel, shown, belowLg } = useStopPanel();
  const steps = wayIn(site);
  const at = steps[Math.min(way.step, steps.length - 1)];
  return (
    <Stop
      section={s}
      ref={ref}
      className="flex-col items-center justify-end text-center lg:pt-[clamp(104px,13vh,140px)] lg:pb-[clamp(120px,17vh,170px)]"
      panel={panel}
      // the panel keeps clear of the lockup at the frame's foot, so it sets
      // a size down from the give stop's and tighter still on a short viewport
      panelClassName="flex w-full max-w-[820px] flex-col items-center gap-5 short:lg:gap-3"
    >
      {/* the kicker stands at the panel's left, its rule drawn from there; the rest is centred */}
      <Kicker className="self-start text-left">{s.kicker}</Kicker>
      <PanelReveal className="flex w-full flex-col items-center gap-5 short:lg:gap-3">
        {/* the words' height eases from one step to the next, so the glass
            grows and shrinks with them instead of jumping */}
        {/* wrapped, so the reveal's own transition stays on the wrapper
            and the height's on the block (Reveal) */}
        <div className="w-full">
          <SmoothHeight className="w-full">
            <div
              key={way.step}
              aria-live="polite"
              className={`${WAY_RISE} flex flex-col items-center gap-5 short:lg:gap-3`}
            >
              {/* the call to write sits under the first step's words, and goes with them */}
              <StopWords
                stop="visit"
                heading={at?.title}
                body={at ? [at.body] : []}
                cta={way.step === 0 ? s.cta : undefined}
              />
            </div>
          </SmoothHeight>
        </div>
        <WayIn
          steps={steps}
          step={way.step}
          dir={way.dir}
          onStep={onStep}
          words={wayInWords(site)}
          shown={shown}
          single={belowLg}
          className="pt-1"
        />
      </PanelReveal>
    </Stop>
  );
}
