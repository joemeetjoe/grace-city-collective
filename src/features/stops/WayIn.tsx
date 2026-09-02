import { memo, useMemo, useRef, type CSSProperties, type RefObject } from "react";

import GatheringMark, { type Emblem } from "@/marks/GatheringMark";
import { FOCUS_RING, STATE, WAY_SLIDE } from "@/theme/classes";
import { lozengePath } from "@/theme/lozenge";
import { DRAW_MS, MARK_TRACE_STAGGER_MS, RULE_STAGGER_MS } from "@/theme/motion";
import type { WayArrowWords, WayInWords, Waymark } from "@/content/site";
import { cn } from "@/lib/utils";
import { stagger, staggerMs } from "./tileGeometry";
import type { Direction } from "./useWayStep";

export type WayInProps = {
  /** the five steps, in order; each takes the emblem at its position */
  steps: Waymark[];
  /** the step the traveller stands on */
  step: number;
  /** which way the traveller last walked to get there (useWayStep): alone, the step slides in from that side */
  dir?: Direction;
  /** the arrows ask for another step */
  onStep: (step: number) => void;
  /** the way in's own words: the list's name, and the arrows' labels and the words under them */
  words: WayInWords;
  /**
   * whether the way is drawn; while false the rule and the emblems wait,
   * and draw in from the first step when it turns true
   */
  shown?: boolean;
  /**
   * whether only the current step stands between the arrows — the phone
   * and tablet way (below lg), where five steps on a rule are cramped: no
   * rule, no traveller, the step's emblem and numeral alone, and on an
   * arrow press the next step's emblem slides in from the side the reader
   * is walking toward
   */
  single?: boolean;
  className?: string;
};

/**
 * The emblem at each step of the way in, in order: one alone (writing to
 * us), one met (the pastor writing back), a family at a table (dinner),
 * the feast (the all-church gathering), and the five homes (the tour).
 */
const WAY_EMBLEMS: readonly Emblem[] = ["one", "two", "table", "feast", "homes"];
const NUMERALS = ["I", "II", "III", "IV", "V"] as const;

/** the traveller: a solid lozenge in the seal's red, in px, and the arrows' drawing box */
const TRAVELLER_W = 10;
const ARROW_W = 44;
const ARROW_H = 24;

/** the rule's halves and the traveller move (700ms, one span RULE_STAGGER_MS after the last) on the site's ease, only where motion is welcome */
const MOVE =
  "motion-safe:transition-[transform,opacity] motion-safe:duration-700 motion-safe:ease-site";

/** the emblems trace in after the rule has reached them; alone, at once */
function traceAt(i: number, single: boolean): number {
  return single ? 0 : staggerMs(i, RULE_STAGGER_MS + MARK_TRACE_STAGGER_MS);
}

/** when the whole rail is drawn: the last emblem's trace is over */
function railDone(last: number, single: boolean): number {
  return traceAt(last, single) + DRAW_MS;
}

/** a half of the rule: drawn on from the left at its turn, and brighter once the traveller has walked it */
function spanStyle(shown: boolean, order: number, drawn: boolean): CSSProperties {
  return {
    transitionDelay: shown ? stagger(order, RULE_STAGGER_MS) : "0ms",
    transform: shown ? "scaleX(1)" : "scaleX(0)",
    opacity: drawn ? 0.55 : 0.22,
  };
}

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
        className="motion-safe:transition-[fill-opacity] duration-500"
      />
      <path
        d={`M${tail} ${cy - 4}L${tip} ${cy}L${tail} ${cy + 4}`}
        fill="none"
        stroke={disabled ? "currentColor" : "var(--color-cream)"}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="motion-safe:transition-[stroke] duration-500"
      />
    </svg>
  );
}

type WayArrowProps = {
  back?: boolean;
  disabled: boolean;
  shown: boolean;
  /** ms after the way is shown before the arrow appears: the back arrow at once, the next once the rail is drawn */
  delay: number;
  words: WayArrowWords;
  onClick: () => void;
  /** the button, for the walk to hand focus across as an arrow disables (#130) */
  ref: RefObject<HTMLButtonElement | null>;
};

/** an arrow with its word under it, level with the rule and the numerals; it appears with the way */
const WayArrow = memo(function WayArrow({ back = false, disabled, shown, delay, words, onClick, ref }: WayArrowProps) {
  const style = useMemo<CSSProperties>(
    () => ({ opacity: shown ? undefined : 0, transitionDelay: shown ? `${delay}ms` : "0ms" }),
    [shown, delay],
  );
  return (
    <button
      ref={ref}
      type="button"
      aria-label={words.label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        // the lozenge sits level with the rule, its word under it level with the numerals
        // both the same width, whatever their words, so the rule between them stays centred
        // on a phone 56px wide, where "before that" wraps to two lines, so the way in — two
        // arrows and five steps — fits a 375px viewport inside its panel (#51); from md wide
        // enough that it stays on one line; it lifts a hair under the pointer, no glow
        "mt-[6px] flex w-[56px] shrink-0 cursor-pointer flex-col items-center gap-[7px] self-start rounded-sm px-0.5 pt-1 text-seal md:w-[108px] md:gap-[5px] md:px-1 motion-safe:transition-[opacity,color,transform] duration-500 ease-site hover:-translate-y-px hover:text-seal-deep active:translate-y-0 disabled:pointer-events-none disabled:text-cream/35",
        FOCUS_RING,
      )}
      style={style}
    >
      <DiamondArrow back={back} disabled={disabled} />
      <span className="text-center text-[10px] leading-[1.3] uppercase tracking-[0.15em] md:whitespace-nowrap md:text-[11px] md:tracking-[0.2em]">
        {words.word}
      </span>
    </button>
  );
});

type WayStepProps = {
  i: number;
  on: boolean;
  walked: boolean;
  last: boolean;
  shown: boolean;
  single: boolean;
  /** alone, the side the step slides in from; the full rail never slides */
  slide?: Direction;
};

/**
 * One step of the way: its emblem over its numeral, the rule in two halves
 * about the emblem so it runs on past a step without crossing its
 * lozenges (each half draws on from the left), and its colour for where
 * the traveller is — lit under it, bright behind it, faint ahead
 */
const WayStep = memo(function WayStep({ i, on, walked, last, shown, single, slide }: WayStepProps) {
  const at = traceAt(i, single);
  const numeralStyle = useMemo<CSSProperties>(
    () => ({ opacity: shown ? 1 : 0, transition: `opacity ${DRAW_MS}ms ease ${at}ms` }),
    [shown, at],
  );
  const before = useMemo(() => spanStyle(shown, 2 * i, walked || on), [shown, i, walked, on]);
  const after = useMemo(() => spanStyle(shown, 2 * i + 1, walked), [shown, i, walked]);
  return (
    <li
      id={`way-in-step-${i}`}
      aria-current={on ? "step" : undefined}
      className={cn(
        "relative flex min-w-0 flex-1 flex-col items-center gap-1 pb-1 motion-safe:transition-colors duration-500",
        on ? "text-seal" : walked ? "text-cream/80" : "text-cream/45",
        slide && WAY_SLIDE[slide],
        on && STATE.on,
        walked && STATE.walked,
      )}
    >
      {!single && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-[18px] flex h-px items-center md:top-[22px]"
        >
          <span
            className={cn(`block h-px flex-1 origin-left bg-cream ${MOVE} mr-[14px] md:mr-[20px]`, (walked || on) && STATE.drawn)}
            style={before}
          />
          <span
            className={cn(`block h-px flex-1 origin-left bg-cream ${MOVE} ml-[14px] md:ml-[20px]`, walked && STATE.drawn)}
            style={after}
          />
        </span>
      )}
      <GatheringMark
        mark={WAY_EMBLEMS[i % WAY_EMBLEMS.length]}
        shown={shown}
        delay={at}
        lit={on}
        tour={on && last}
        // 36px on a phone (the rule and its margins about the emblem scale with it), 44 from
        // md; alone between the arrows, with the room, the drawing's own 44 throughout
        className={single ? "relative h-11 w-11" : "relative h-9 w-9 md:h-11 md:w-11"}
      />
      <span className="text-[10px] tracking-[0.12em] md:text-[11px] font-serif" style={numeralStyle}>
        {NUMERALS[i] ?? i + 1}
      </span>
    </li>
  );
});

/** the traveller: a solid lozenge on the rule that walks to the lit step */
const Traveller = memo(function Traveller({ step, count, shown, at }: { step: number; count: number; shown: boolean; at: number }) {
  const style = useMemo<CSSProperties>(
    () => ({
      transform: `translateX(${step * 100}%)`,
      opacity: shown ? 1 : 0,
      // the walk is never delayed; the first appearance waits for the rule
      transitionDelay: shown ? `0ms, ${at}ms` : "0ms, 0ms",
      width: `${100 / count}%`,
    }),
    [step, count, shown, at],
  );
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute top-[20px] left-0 flex h-0 items-center justify-center ${MOVE} md:top-[22px]`}
      style={style}
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
  );
});

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
 * the visit stop keeps it (useWayStep), and sets the step's words above
 * the rule.
 *
 * `single` (below lg) shows the current step alone between the arrows:
 * the list holds only that step, remounted on each change, and it slides
 * in from the right walking on and from the left walking back
 * (WAY_SLIDE, index.css, only where motion is welcome); there is no
 * rule to draw, so the one emblem traces in at once and the arrows follow.
 *
 * An arrow that reaches its end disables, and a disabled button drops the
 * keyboard's focus on the floor: so the walk hands focus to the other arrow
 * first, in the same press (#130), and the reader turns round where they are.
 */
export default function WayIn({
  steps,
  step,
  dir,
  onStep,
  words,
  shown = true,
  single = false,
  className,
}: WayInProps) {
  const count = steps.length;
  const last = count - 1;
  const done = railDone(last, single);
  const shownSteps = single ? [step] : steps.map((_, i) => i);
  const backRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  /** a walk to `to`: focus crosses to the other arrow before this one disables at an end */
  const walk = (to: number, from: RefObject<HTMLButtonElement | null>, other: RefObject<HTMLButtonElement | null>) => {
    const end = to === 0 || to === last;
    if (end && from.current && document.activeElement === from.current) other.current?.focus();
    onStep(to);
  };
  return (
    <div className={cn("flex w-full flex-col items-center", className)}>
      {/* no gap on a phone: the arrows and the steps together are the panel's whole width at 375px */}
      <div className="flex w-full items-center md:gap-2">
        <WayArrow
          ref={backRef}
          back
          disabled={step === 0}
          shown={shown}
          delay={0}
          words={words.back}
          onClick={() => walk(Math.max(0, step - 1), backRef, nextRef)}
        />
        <ol aria-label={words.list} className="relative flex min-w-0 flex-1 items-start">
          {/* alone, the current step only, keyed by its index so each step mounts afresh and slides in */}
          {shownSteps.map((i) => (
            <WayStep
              key={single ? i : steps[i].title}
              i={i}
              on={i === step}
              walked={i < step}
              last={i === last}
              shown={shown}
              single={single}
              slide={single ? dir : undefined}
            />
          ))}
          {!single && <Traveller step={step} count={count} shown={shown} at={done} />}
        </ol>
        <WayArrow
          ref={nextRef}
          disabled={step === last}
          shown={shown}
          delay={done}
          words={words.next}
          onClick={() => walk(Math.min(last, step + 1), nextRef, backRef)}
        />
      </div>
    </div>
  );
}
