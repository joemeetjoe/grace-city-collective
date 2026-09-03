import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { site, wayInWords } from "@/content/site";
import { STATE, WAY_SLIDE } from "@/theme/classes";
import { MARK_TRACE_STAGGER_MS, RULE_STAGGER_MS } from "@/theme/motion";
import { useWayStep } from "./useWayStep";
import WayIn, { type WayInProps } from "./WayIn";

const STEPS = [
  { id: "hello", title: "Say hello.", body: "Write to us." },
  { id: "reply", title: "A pastor writes back.", body: "A real person." },
  { id: "dinner", title: "Dinner.", body: "A meal with you and yours." },
  { id: "first-sunday", title: "First Sunday, all together.", body: "The five rooms become one." },
  { id: "rounds", title: "Make the rounds.", body: "A Sunday in each home." },
];

const WORDS = wayInWords(site);

/** the way in with a step of its own, the way the visit stop keeps one (useWayStep) */
function Way({ initial = 0, ...rest }: { initial?: number } & Omit<WayInProps, "step" | "dir" | "onStep" | "words">) {
  const [way, onStep] = useWayStep(initial);
  return <WayIn step={way.step} dir={way.dir} onStep={onStep} words={WORDS} {...rest} />;
}

const list = () => screen.getByRole("list", { name: WORDS.list });
const steps = () => screen.getAllByRole("listitem");
const current = () => screen.getByRole("listitem", { current: "step" });
const next = () => screen.getByRole("button", { name: WORDS.next.label });
const back = () => screen.getByRole("button", { name: WORDS.back.label });
/** the traveller: the one child of the list that is not a step */
const traveller = () => list().querySelector<HTMLElement>(":scope > span");
/** the rule's halves, in order along the rail */
const spans = () => Array.from(list().querySelectorAll<HTMLElement>("li > span[aria-hidden] > span"));
/** the emblems' svgs, in order */
const emblems = () => Array.from(list().querySelectorAll("svg[data-gathering-mark]"));

describe("WayIn", () => {
  it("draws the five steps as the emblems in order, with the traveller on the first", () => {
    render(<Way steps={STEPS} />);
    expect(emblems().map((m) => m.getAttribute("data-gathering-mark"))).toEqual([
      "one",
      "two",
      "table",
      "feast",
      "homes",
    ]);
    expect(steps()).toHaveLength(5);
    expect(current()).toBe(steps()[0]);
    expect(current()).toHaveClass(STATE.on);
    expect(traveller()!.style.transform).toBe("translateX(0%)");
    expect(traveller()!.style.width).toBe("20%");
  });

  it("names its arrows and the list from the content module", () => {
    render(<Way steps={STEPS} />);
    expect(list()).toBeInTheDocument();
    expect(next()).toHaveTextContent(WORDS.next.word);
    expect(back()).toHaveTextContent(WORDS.back.word);
    expect(WORDS).toEqual({
      list: "The way in",
      back: { label: "Back a step", word: "Before that" },
      next: { label: "Next step", word: "And then" },
    });
  });

  it("only the lit emblem gathers; the tour runs only on the last step when lit", () => {
    const { container } = render(<Way steps={STEPS} initial={4} />);
    const lit = emblems().filter((m) => m.hasAttribute("data-lit"));
    expect(lit.map((m) => m.getAttribute("data-gathering-mark"))).toEqual(["homes"]);
    expect(container.querySelectorAll("path[data-called]").length).toBe(5);
    const { container: first } = render(<Way steps={STEPS} />);
    expect(first.querySelectorAll("path[data-called]").length).toBe(0);
  });

  it("a step under the pointer, or tapped, stays put: only the arrows move the traveller", () => {
    render(<Way steps={STEPS} />);
    fireEvent.mouseEnter(steps()[2]);
    fireEvent.click(steps()[3]);
    expect(current()).toBe(steps()[0]);
    expect(list().querySelectorAll("button").length).toBe(0);
  });

  it("the steps walked stay bright, the current is lit, the rest wait", () => {
    render(<Way steps={STEPS} initial={2} />);
    expect(traveller()!.style.transform).toBe("translateX(200%)");
    const ts = steps();
    expect(ts[0]).toHaveClass(STATE.walked);
    expect(ts[1]).toHaveClass(STATE.walked);
    expect(ts[2]).toHaveClass(STATE.on);
    expect(ts[2]).not.toHaveClass(STATE.walked);
    expect(ts[2]).toHaveAttribute("aria-current", "step");
    expect(ts[3]).not.toHaveClass(STATE.walked);
    expect(ts[3]).not.toHaveClass(STATE.on);
    // the rule is drawn up to the current step: both halves of the walked steps, the first half of the current
    const drawn = spans().map((s) => s.classList.contains(STATE.drawn));
    expect(drawn).toEqual([true, true, true, true, true, false, false, false, false, false]);
    expect(spans()[4].style.opacity).toBe("0.55");
    expect(spans()[5].style.opacity).toBe("0.22");
  });

  it("the diamond arrows step back and forward, and rest at the ends", () => {
    render(<Way steps={STEPS} />);
    expect(back()).toBeDisabled();
    expect(next()).toBeEnabled();
    fireEvent.click(next());
    fireEvent.click(next());
    expect(current()).toBe(steps()[2]);
    expect(back()).toBeEnabled();
    fireEvent.click(back());
    expect(current()).toBe(steps()[1]);
    for (let i = 0; i < 6; i++) fireEvent.click(next());
    expect(current()).toBe(steps()[4]);
    expect(next()).toBeDisabled();
  });

  it("waits undrawn until shown, then the rule draws on from the left and each emblem traces after it", () => {
    render(<Way steps={STEPS} shown={false} />);
    expect(spans().length).toBe(10);
    expect(spans().every((s) => s.style.transform === "scaleX(0)")).toBe(true);
    expect(traveller()!.style.opacity).toBe("0");
    expect(next().style.opacity).toBe("0");
    const { container: shown } = render(<Way steps={STEPS} />);
    const drawn = Array.from(shown.querySelectorAll<HTMLElement>("li > span[aria-hidden] > span"));
    expect(drawn.map((s) => parseFloat(s.style.transitionDelay))).toEqual(
      drawn.map((_, i) => i * RULE_STAGGER_MS),
    );
    const firstLozenge = (i: number) =>
      parseFloat(
        shown.querySelectorAll<SVGPathElement>("svg[data-gathering-mark]")[i].querySelector("path")!.style
          .transitionDelay,
      );
    expect(firstLozenge(1) - firstLozenge(0)).toBe(RULE_STAGGER_MS + MARK_TRACE_STAGGER_MS);
  });

  it("carries no data attributes of its own: its states are classes (the emblems' are GatheringMark's)", () => {
    const { container } = render(<Way steps={STEPS} initial={2} />);
    for (const el of container.querySelectorAll("*")) {
      if (el.closest("svg[data-gathering-mark]")) continue;
      expect(el.getAttributeNames().filter((n) => n.startsWith("data-"))).toEqual([]);
    }
  });

  describe("single: the current step alone between the arrows (below lg)", () => {
    it("renders only the current step's emblem and numeral, lit, with no rule and no traveller", () => {
      render(<Way steps={STEPS} single initial={2} />);
      const ts = steps();
      expect(ts.length).toBe(1);
      expect(ts[0]).toHaveAttribute("id", "way-in-step-2");
      expect(ts[0]).toHaveAttribute("aria-current", "step");
      expect(ts[0]).toHaveClass(STATE.on);
      expect(ts[0]).toHaveTextContent("III");
      expect(emblems().map((m) => m.getAttribute("data-gathering-mark"))).toEqual(["table"]);
      expect(emblems()[0].hasAttribute("data-lit")).toBe(true);
      expect(spans()).toHaveLength(0);
      expect(traveller()).toBeNull();
      expect(list()).toBeInTheDocument();
      // the one emblem traces in at once
      expect(emblems()[0].querySelector<SVGPathElement>("path")!.style.transitionDelay).toBe("0ms");
    });

    it("the arrows still step, and the tour runs on the last", () => {
      const { container } = render(<Way steps={STEPS} single initial={3} />);
      expect(back()).toBeEnabled();
      fireEvent.click(next());
      expect(steps().map((t) => t.id)).toEqual(["way-in-step-4"]);
      expect(container.querySelectorAll("path[data-called]").length).toBe(5);
      expect(next()).toBeDisabled();
      fireEvent.click(back());
      expect(steps().map((t) => t.id)).toEqual(["way-in-step-3"]);
    });

    it("slides the new step in from the side the traveller walks toward: next from the right, back from the left", () => {
      render(<Way steps={STEPS} single />);
      // at rest on the first step nothing has moved: the step simply draws in
      expect(steps()[0].className).not.toMatch(/way-in-slide/);
      fireEvent.click(next());
      expect(steps()[0]).toHaveClass(WAY_SLIDE.next);
      fireEvent.click(next());
      expect(steps()[0]).toHaveClass(WAY_SLIDE.next);
      fireEvent.click(back());
      expect(steps()[0]).toHaveClass(WAY_SLIDE.back);
      expect(steps()[0]).not.toHaveClass(WAY_SLIDE.next);
    });

    it("the full rail never slides", () => {
      render(<Way steps={STEPS} />);
      fireEvent.click(next());
      expect(steps().some((t) => /way-in-slide/.test(t.className))).toBe(false);
      expect(steps().length).toBe(5);
    });
  });
});
