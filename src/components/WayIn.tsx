import type { CSSProperties } from "react";

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
  /** the step the traveller stands on */
  step: number;
  /** the arrows ask for another step */
  onStep: (step: number) => void;
  /**
   * whether the way is drawn; while false the rule and the emblems wait,
   * and draw in from the first step when it turns true
   */
  shown?: boolean;
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
const ARROW_W = 44;
const ARROW_H = 24;

/** the rule's halves and the traveller move on the site's ease, only where motion is welcome */
const MOVE =
  "motion-safe:transition-[transform,opacity] motion-safe:duration-700 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)]";

/**
 * A diamond arrow: a lozenge filled in the seal's red with a cream chevron
 * pointing the way — a button in the site's own shape, with "and then" or
 * "before that" under it, the way the story is told. Under the pointer it
 * lifts a hair; at the end of the way it empties to a hairline and waits.
 */
function DiamondArrow({ back = false, disabled = false }: { back?: boolean; disabled?: boolean }) {
  const cx = ARROW_W / 2;
  const cy = ARROW_H / 2;
  const tip = back ? cx - 5 : cx + 5;
  const tail = back ? cx + 2 : cx - 2;
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${ARROW_W} ${ARROW_H}`}
      // drawn at 36×20 on a phone, full size from md
      className="block h-5 w-9 overflow-visible md:h-6 md:w-11"
    >
      <path
        d={lozengePath(cx, cy, ARROW_W, ARROW_H)}
        fill="currentColor"
        fillOpacity={disabled ? 0 : 1}
        stroke="currentColor"
        strokeWidth={1}
        className="transition-[fill-opacity] duration-500"
      />
      <path
        d={`M${tail} ${cy - 4}L${tip} ${cy}L${tail} ${cy + 4}`}
        fill="none"
        stroke={disabled ? "currentColor" : "var(--color-cream)"}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="transition-[stroke] duration-500"
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
 * steps ahead wait fainter. When `shown` turns true the rule draws from
 * the first step to the last, the emblems trace in one after the next, and
 * the traveller appears on the first. Only the arrows move the traveller
 * — a step under the pointer stays put. The step itself is the caller's:
 * the visit stop keeps it, and sets the step's words above the rule.
 */
export default function WayIn({ steps, step, onStep, shown = true, className }: WayInProps) {
  const count = steps.length;
  const last = count - 1;
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
        onClick={() => onStep(Math.max(0, Math.min(last, step + (back ? -1 : 1))))}
        data-way-arrow={back ? "back" : "next"}
        className={cn(
          // the lozenge sits level with the rule, its word under it level with the numerals
          // both the same width, whatever their words, so the rule between them stays centred
          // on a phone 56px wide, where "before that" wraps to two lines, so the way in — two
          // arrows and five steps — fits a 375px viewport inside its panel (#51); from md wide
          // enough that it stays on one line; it lifts a hair under the pointer, no glow
          "mt-[6px] flex w-[56px] shrink-0 cursor-pointer flex-col items-center gap-[7px] self-start rounded-sm px-0.5 pt-1 text-seal md:w-[108px] md:gap-[5px] md:px-1 transition-[opacity,color,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px hover:text-seal-deep active:translate-y-0 disabled:pointer-events-none disabled:text-cream/35",
          FOCUS_RING,
        )}
        style={{
          opacity: shown ? undefined : 0,
          transitionDelay: shown ? `${back ? 0 : railDone}ms` : "0ms",
        }}
      >
        <DiamondArrow back={back} disabled={disabled} />
        <span className="text-center text-[10px] leading-[1.3] uppercase tracking-[0.15em] md:whitespace-nowrap md:text-[11px] md:tracking-[0.2em]">
          {back ? "Before that" : "And then"}
        </span>
      </button>
    );
  };
  return (
    <div data-way-in="" data-step={step} className={cn("flex w-full flex-col items-center", className)}>
      {/* no gap on a phone: the arrows and the steps together are the panel's whole width at 375px */}
      <div className="flex w-full items-center md:gap-2">
        {arrow(true)}
        <ol aria-label="The way in" className="relative flex min-w-0 flex-1 items-start">
          {steps.map((s, i) => {
            const on = i === step;
            const walked = i < step;
            return (
              <li
                key={s.title}
                id={`way-in-step-${i}`}
                aria-current={on ? "step" : undefined}
                data-way-step={i}
                data-on={on ? "" : undefined}
                data-walked={walked ? "" : undefined}
                className={cn(
                  "relative flex min-w-0 flex-1 flex-col items-center gap-1 pb-1 transition-colors duration-500",
                  on ? "text-seal" : walked ? "text-cream/80" : "text-cream/45",
                )}
              >
                {/* the rule, in two halves about the emblem, so it runs on past a step
                    without crossing its lozenges; each half draws on from the left */}
                <span
                  aria-hidden
                  data-way-rule=""
                  className="pointer-events-none absolute inset-x-0 top-[18px] flex h-px items-center md:top-[22px]"
                >
                  <span
                    className={`block h-px flex-1 origin-left bg-cream ${MOVE} mr-[14px] md:mr-[20px]`}
                    style={spanStyle(2 * i, walked || on)}
                  />
                  <span
                    className={`block h-px flex-1 origin-left bg-cream ${MOVE} ml-[14px] md:ml-[20px]`}
                    style={spanStyle(2 * i + 1, walked)}
                  />
                </span>
                <GatheringMark
                  mark={WAY_EMBLEMS[i % WAY_EMBLEMS.length]}
                  shown={shown}
                  delay={traceAt(i)}
                  lit={on}
                  tour={on && i === last}
                  // 36px on a phone (the rule and its margins about the emblem scale with it), 44 from md
                  className="relative h-9 w-9 md:h-11 md:w-11"
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
              </li>
            );
          })}
          {/* the traveller: a solid lozenge on the rule that walks to the lit step */}
          <span
            aria-hidden
            data-way-traveller=""
            className={`pointer-events-none absolute top-[20px] left-0 flex h-0 items-center justify-center ${MOVE} md:top-[22px]`}
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
        </ol>
        {arrow(false)}
      </div>
    </div>
  );
}
