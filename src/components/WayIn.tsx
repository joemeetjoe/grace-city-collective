import { useState, type CSSProperties } from "react";

import GatheringMark, {
  type Emblem,
  TRACE_MS,
  TRACE_STAGGER_MS,
} from "@/components/GatheringMark";
import { FOCUS_RING } from "@/components/interact";
import { lozengePath } from "@/components/lozenge";
import type { Waymark } from "@/content/site";
import { cn } from "@/lib/utils";

export type WayInProps = {
  /** the five steps, in order; each takes the emblem at its position */
  steps: Waymark[];
  /**
   * whether the way is drawn; while false the rule and the emblems wait,
   * and draw in from the first step when it turns true
   */
  shown?: boolean;
  /** which step the traveller starts on */
  initial?: number;
  className?: string;
};

/**
 * The emblem at each step of the way in, in order: one alone (writing to
 * us), one met (the pastor writing back), a family at a table (dinner),
 * the feast (the all-church gathering), and the five homes (the tour).
 */
const WAY_EMBLEMS: readonly Emblem[] = ["one", "two", "table", "feast", "homes"];
const NUMERALS = ["I", "II", "III", "IV", "V"] as const;

/** the wait from one span of the rule drawing to the next, in ms (each takes MOVE's 700) */
export const RULE_STAGGER_MS = 160;

/** the traveller: a solid lozenge in the seal's red, in px, and the arrows' drawing box */
const TRAVELLER_W = 10;
const ARROW_W = 22;
const ARROW_H = 12;

/** the rule's halves and the traveller move on the site's ease, only where motion is welcome */
const MOVE =
  "motion-safe:transition-[transform,opacity] motion-safe:duration-700 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)]";

/**
 * A diamond arrow: a hollow lozenge with a hairline chevron pointing the
 * way, in currentColor. It fills under the pointer like a lit emblem.
 */
function DiamondArrow({ back = false }: { back?: boolean }) {
  const cx = ARROW_W / 2;
  const cy = ARROW_H / 2;
  const tip = back ? cx - 3 : cx + 3;
  const tail = back ? cx + 1 : cx - 1;
  return (
    <svg
      aria-hidden
      width={ARROW_W}
      height={ARROW_H}
      viewBox={`0 0 ${ARROW_W} ${ARROW_H}`}
      className="block overflow-visible"
    >
      <path
        d={lozengePath(cx, cy, ARROW_W, ARROW_H)}
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={1}
        fillOpacity={0}
        className="transition-[fill-opacity] duration-500 group-hover:[fill-opacity:1]"
      />
      <path
        d={`M${tail} ${cy - 2.5}L${tip} ${cy}L${tail} ${cy + 2.5}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={1}
        className="transition-[stroke] duration-500 group-hover:stroke-ink"
      />
    </svg>
  );
}

/**
 * The way in: five steps along a hairline rule with a diamond arrow at each
 * end, and one solid lozenge in the seal's red — the reader — that walks
 * the rule from step to step. Each step is an emblem in the gatherings'
 * hollow-lozenge hairline (GatheringMark), which gathers itself when the
 * traveller arrives; the steps already walked stay traced in cream, the
 * steps ahead wait fainter. The step's words sit under the rule and rise
 * in when the traveller lands. When `shown` turns true the rule draws from
 * the first step to the last, the emblems trace in one after the next, and
 * the traveller appears on the first. A step is a tab: the pointer, a tap
 * or the arrows move the traveller, and the words follow.
 */
export default function WayIn({ steps, shown = true, initial = 0, className }: WayInProps) {
  const [step, setStep] = useState(initial);
  const count = steps.length;
  const last = count - 1;
  const current = steps[step];
  // the emblems trace in after the rule has reached them
  const traceAt = (i: number) => i * (RULE_STAGGER_MS + TRACE_STAGGER_MS);
  const railDone = traceAt(last) + TRACE_MS;
  const spanStyle = (i: number, drawn: boolean): CSSProperties => ({
    transitionDelay: shown ? `${i * RULE_STAGGER_MS}ms` : "0ms",
    transform: shown ? "scaleX(1)" : "scaleX(0)",
    opacity: drawn ? 0.55 : 0.22,
  });
  const travellerStyle: CSSProperties = {
    transform: `translateX(${step * 100}%)`,
    opacity: shown ? 1 : 0,
    // the walk is never delayed; the first appearance waits for the rule
    transitionDelay: shown ? `0ms, ${railDone}ms` : "0ms, 0ms",
  };
  const arrow = (back: boolean) => {
    const disabled = back ? step === 0 : step === last;
    return (
      <button
        type="button"
        aria-label={back ? "Back a step" : "Next step"}
        disabled={disabled}
        onClick={() => setStep((s) => Math.max(0, Math.min(last, s + (back ? -1 : 1))))}
        data-way-arrow={back ? "back" : "next"}
        className={cn(
          "group mt-[10px] shrink-0 cursor-pointer self-start rounded-sm p-1 text-cream/60 md:mt-[12px] transition-[opacity,color] duration-500 hover:text-seal disabled:pointer-events-none disabled:opacity-25",
          FOCUS_RING,
        )}
        style={{
          opacity: shown ? undefined : 0,
          transitionDelay: shown ? `${back ? 0 : railDone}ms` : "0ms",
        }}
      >
        <DiamondArrow back={back} />
      </button>
    );
  };
  return (
    <div data-way-in="" data-step={step} className={cn("flex w-full flex-col items-center", className)}>
      <div className="flex w-full items-center gap-1 md:gap-2">
        {arrow(true)}
        <div role="tablist" aria-label="The way in" className="relative flex min-w-0 flex-1 items-start">
          {steps.map((s, i) => {
            const on = i === step;
            const walked = i < step;
            return (
              <button
                key={s.title}
                type="button"
                role="tab"
                id={`way-in-tab-${i}`}
                aria-selected={on}
                aria-controls="way-in-step"
                tabIndex={on ? 0 : -1}
                data-way-step={i}
                data-on={on ? "" : undefined}
                data-walked={walked ? "" : undefined}
                onClick={() => setStep(i)}
                onMouseEnter={() => setStep(i)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight") setStep(Math.min(last, i + 1));
                  if (e.key === "ArrowLeft") setStep(Math.max(0, i - 1));
                }}
                className={cn(
                  "relative flex min-w-0 flex-1 cursor-pointer flex-col items-center gap-1 rounded-sm pb-1 transition-colors duration-500",
                  on ? "text-seal" : walked ? "text-cream/80" : "text-cream/45",
                  FOCUS_RING,
                )}
              >
                {/* the rule, in two halves about the emblem, so it runs on past a step
                    without crossing its lozenges; each half draws on from the left */}
                <span
                  aria-hidden
                  data-way-rule=""
                  className="pointer-events-none absolute inset-x-0 top-[20px] flex h-px items-center md:top-[22px]"
                >
                  <span
                    className={`block h-px flex-1 origin-left bg-cream ${MOVE} mr-[16px] md:mr-[20px]`}
                    style={spanStyle(2 * i, walked || on)}
                  />
                  <span
                    className={`block h-px flex-1 origin-left bg-cream ${MOVE} ml-[16px] md:ml-[20px]`}
                    style={spanStyle(2 * i + 1, walked)}
                  />
                </span>
                <GatheringMark
                  mark={WAY_EMBLEMS[i % WAY_EMBLEMS.length]}
                  shown={shown}
                  delay={traceAt(i)}
                  lit={on}
                  tour={on && i === last}
                  className="relative h-10 w-10 md:h-11 md:w-11"
                />
                <span
                  className="text-[10px] tracking-[0.12em] md:text-[11px] [font-family:'Cormorant_Garamond',Georgia,serif]"
                  style={{
                    opacity: shown ? 1 : 0,
                    transition: `opacity ${TRACE_MS}ms ease ${traceAt(i)}ms`,
                  }}
                >
                  {NUMERALS[i] ?? i + 1}
                </span>
              </button>
            );
          })}
          {/* the traveller: a solid lozenge on the rule that walks to the lit step */}
          <span
            aria-hidden
            data-way-traveller=""
            className={`pointer-events-none absolute top-[22px] left-0 flex h-0 items-center justify-center ${MOVE} md:top-[22px]`}
            style={{ ...travellerStyle, width: `${100 / count}%` }}
          >
            <svg
              width={TRAVELLER_W}
              height={TRAVELLER_W / 2}
              viewBox={`0 0 ${TRAVELLER_W} ${TRAVELLER_W / 2}`}
              className="block text-seal"
            >
              <path d={lozengePath(TRAVELLER_W / 2, TRAVELLER_W / 4, TRAVELLER_W, TRAVELLER_W / 2)} fill="currentColor" stroke="currentColor" strokeWidth={1} />
            </svg>
          </span>
        </div>
        {arrow(false)}
      </div>
      {current && (
        <div
          key={step}
          id="way-in-step"
          role="tabpanel"
          aria-labelledby={`way-in-tab-${step}`}
          aria-live="polite"
          data-way-words=""
          className="way-in-rise mt-3 flex flex-col items-center gap-2 text-center md:mt-4 [@media(max-height:820px)]:lg:gap-1.5"
        >
          <h3 className="text-[24px] leading-[1.12] md:text-[30px] [@media(max-height:820px)]:lg:text-[26px] [font-family:'Cormorant_Garamond',Georgia,serif]">
            {current.title}
          </h3>
          <p className="max-w-[46ch] text-[15px] leading-[1.5] text-pretty text-cream/75 md:text-[17px] md:leading-relaxed [@media(max-height:820px)]:lg:text-[15px]">
            {current.body}
          </p>
        </div>
      )}
    </div>
  );
}
