import { useContext, useState } from "react";

import SowingMark from "@/marks/SowingMark";
import Bracketed, { PanelShownContext } from "@/ui/panel/Bracketed";
import Kicker from "@/ui/panel/Kicker";
import PanelReveal from "@/ui/panel/PanelReveal";
import type { SceneSection } from "@/content/site";
import { SEAL_BUTTON, serif } from "@/app/styles";
import { PHONE_BODY, TUCK, stopFrame } from "@/stops/tuck";
import { useStopPanel } from "@/stops/useStopPanel";

/**
 * The giving's ornament: a field sown and reaped in the G mark's box
 * (SowingMark), standing in the band the give panel pads on its left to keep
 * its words centred under the hood (TUCK). It cascades in with the panel's
 * brackets and the harvest fills while the reader is over the panel. Below
 * lg there is no band: the field stands at the head of the panel over the
 * words, a size that keeps its tiles the calendar's, and fills while the
 * stop is settled on screen (Scene).
 */
function GiveSowing({ lit }: { lit: boolean }) {
  const shown = useContext(PanelShownContext);
  return (
    <div
      data-give-sowing=""
      // on desktop it starts at the glass's padding and runs the width of
      // the house table's column (HouseChurchesTable), wider than the give
      // tuck alone: the words set narrower than the room the tuck leaves
      // them, so the field can borrow the slack and keep tiles the
      // calendar's size
      className="relative w-[clamp(120px,32vw,150px)] lg:absolute lg:top-1/2 lg:left-[clamp(18px,2.6vw,32px)] lg:w-[clamp(140px,11.5vw,200px)] lg:-translate-y-1/2"
    >
      <SowingMark lit={lit} shown={shown} className="w-full" />
    </div>
  );
}

export default function GiveStop({ section: s }: { section: SceneSection }) {
  // whether the pointer is over the giving, filling the field beside its words
  const [giving, setGiving] = useState(false);
  const { panel, belowLg, playing } = useStopPanel();
  const { base, clear } = stopFrame(s.id);
  return (
    <section
      id={s.id}
      data-screen-label={s.label}
      className={`${base} flex-col items-center text-center justify-center ${clear} lg:pt-[clamp(100px,13vh,130px)] lg:pb-[clamp(150px,20vh,190px)]`}
    >
      <Bracketed
        {...panel}
        className={`flex flex-col items-center gap-5 md:gap-[26px] ${TUCK[s.id] ?? ""}`}
        onMouseEnter={s.id === "give" ? () => setGiving(true) : undefined}
        onMouseLeave={s.id === "give" ? () => setGiving(false) : undefined}
      >
        {s.id === "give" && (
          <GiveSowing lit={belowLg ? playing : giving} />
        )}
        <Kicker centred>{s.kicker}</Kicker>
        <PanelReveal className="flex flex-col items-center gap-5 md:gap-[26px]">
          <h2
            className={`max-w-[20ch] text-[clamp(40px,5.2vw,76px)] leading-[1.04] text-balance [@media(max-height:820px)]:lg:text-[56px] ${serif}`}
          >
            {s.heading}
          </h2>
          {s.body.map((p) => (
            <p
              key={p}
              className={`max-w-[52ch] text-base leading-relaxed text-pretty text-cream/80 md:text-lg lg:max-w-[38ch] min-[1440px]:max-w-[40ch] 2xl:max-w-[44ch] [@media(max-height:820px)]:lg:text-base ${PHONE_BODY}`}
            >
              {p}
            </p>
          ))}
          {s.cta && (
            <a
              href={s.cta.href}
              className={`${SEAL_BUTTON} px-[34px] py-4 text-xs font-bold uppercase tracking-[0.2em]`}
            >
              {s.cta.label}
            </a>
          )}
        </PanelReveal>
      </Bracketed>
    </section>
  );
}
