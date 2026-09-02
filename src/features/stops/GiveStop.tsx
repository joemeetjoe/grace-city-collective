import { useContext, useState } from "react";

import SowingMark from "@/marks/SowingMark";
import Bracketed, { PanelShownContext } from "@/ui/panel/Bracketed";
import Kicker from "@/ui/panel/Kicker";
import PanelReveal from "@/ui/panel/PanelReveal";
import { TUCK, button, stopBody, stopFrame, stopHeading } from "@/theme/classes";
import type { StopProps } from "./Scene";
import { useStopPanel } from "./useStopPanel";

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
      className="relative w-[clamp(120px,32vw,150px)] lg:absolute lg:top-1/2 lg:left-panel-pad lg:w-[clamp(140px,11.5vw,200px)] lg:-translate-y-1/2"
    >
      <SowingMark lit={lit} shown={shown} className="w-full" />
    </div>
  );
}

export default function GiveStop({ section: s, ref }: StopProps) {
  // whether the pointer is over the giving, filling the field beside its words
  const [giving, setGiving] = useState(false);
  const { panel, belowLg, playing } = useStopPanel();
  const { base, clear } = stopFrame(s.id);
  return (
    <section
      ref={ref}
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
            className={stopHeading({ stop: "give" })}
          >
            {s.heading}
          </h2>
          {s.body.map((p) => (
            <p
              key={p}
              className={stopBody({ stop: "give" })}
            >
              {p}
            </p>
          ))}
          {s.cta && (
            <a
              href={s.cta.href}
              className={button({ intent: "seal", size: "cta" })}
            >
              {s.cta.label}
            </a>
          )}
        </PanelReveal>
      </Bracketed>
    </section>
  );
}
