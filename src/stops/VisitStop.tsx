import { useContext, useState } from "react";

import Bracketed, { PanelShownContext } from "@/components/panel/Bracketed";
import Kicker from "@/components/panel/Kicker";
import PanelReveal from "@/components/panel/PanelReveal";
import SmoothHeight from "@/components/SmoothHeight";
import WayIn from "@/components/WayIn";
import { type SceneSection, wayIn } from "@/content/site";
import { useSite } from "@/content/useSite";
import { SEAL_BUTTON, serif } from "@/app/styles";
import { PHONE_BODY, stopFrame } from "@/stops/tuck";
import { useStopPanel } from "@/stops/useStopPanel";

/**
 * The visit stop's way in (WayIn): five steps from a first hello to a house
 * church of one's own, drawn in with the panel's brackets; the reader walks
 * them by the diamond arrows. Below lg (`single`) the current step stands
 * alone between the arrows, and the next slides in when one is pressed.
 */
function TheWayIn({
  step,
  onStep,
  single,
}: {
  step: number;
  onStep: (step: number) => void;
  single: boolean;
}) {
  const site = useSite();
  const shown = useContext(PanelShownContext);
  return (
    <WayIn
      steps={wayIn(site)}
      step={step}
      onStep={onStep}
      shown={shown}
      single={single}
      className="pt-1"
    />
  );
}

export default function VisitStop({ section: s }: { section: SceneSection }) {
  const site = useSite();
  // the step of the way in the reader stands on (visit)
  const [way, setWay] = useState(0);
  const { panel, belowLg } = useStopPanel();
  const { base, clear } = stopFrame(s.id);
  const steps = wayIn(site);
  const at = steps[Math.min(way, steps.length - 1)];
  // the dove hangs in the upper third of the visit frame; the panel sits
  // under it, and fills the frame's width up to a reading measure. Its
  // headline and body are the current step's, and rise in each time the
  // traveller lands; the way in itself stands at the panel's foot
  return (
    <section
      id={s.id}
      data-screen-label={s.label}
      className={`${base} ${clear} flex-col items-center justify-end text-center lg:pt-[clamp(104px,13vh,140px)] lg:pb-[clamp(120px,17vh,170px)]`}
    >
      {/* the panel keeps clear of the lockup at the frame's foot, so it sets
          a size down from the give stop's and tighter still on a short viewport */}
      <Bracketed
        {...panel}
        className="flex w-full max-w-[820px] flex-col items-center gap-5 [@media(max-height:820px)]:lg:gap-3"
      >
        {/* the kicker stands at the panel's left, its rule drawn from there; the rest is centred */}
        <Kicker className="self-start text-left">{s.kicker}</Kicker>
        <PanelReveal className="flex w-full flex-col items-center gap-5 [@media(max-height:820px)]:lg:gap-3">
          {/* the words' height eases from one step to the next, so the glass
              grows and shrinks with them instead of jumping */}
          {/* wrapped, so the reveal's own transition stays on the wrapper
              and the height's on the block (Reveal) */}
          <div className="w-full">
            <SmoothHeight className="w-full">
              <div
                key={way}
                data-way-words=""
                aria-live="polite"
                className="way-in-rise flex flex-col items-center gap-5 [@media(max-height:820px)]:lg:gap-3"
              >
                <h2
                  className={`max-w-[20ch] text-[clamp(36px,4.2vw,56px)] leading-[1.04] text-balance [@media(max-height:820px)]:lg:text-[42px] ${serif}`}
                >
                  {at?.title}
                </h2>
                <p className={`max-w-[52ch] text-base leading-relaxed text-pretty text-cream/80 md:text-lg [@media(max-height:820px)]:lg:text-base ${PHONE_BODY}`}>
                  {at?.body}
                </p>
                {/* the call to write sits under the first step's words, and goes with them */}
                {way === 0 && s.cta && (
                  <a
                    href={s.cta.href}
                    className={`${SEAL_BUTTON} px-[34px] py-4 text-xs font-bold uppercase tracking-[0.2em]`}
                  >
                    {s.cta.label}
                  </a>
                )}
              </div>
            </SmoothHeight>
          </div>
          <TheWayIn step={way} onStep={setWay} single={belowLg} />
        </PanelReveal>
      </Bracketed>
    </section>
  );
}
