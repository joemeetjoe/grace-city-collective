import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import WayIn, { RULE_STAGGER_MS } from "./WayIn";
import { TRACE_STAGGER_MS } from "./GatheringMark";

const STEPS = [
  { title: "Say hello.", body: "Write to us." },
  { title: "A pastor writes back.", body: "A real person." },
  { title: "Dinner.", body: "A meal with you and yours." },
  { title: "First Sunday, all together.", body: "The five rooms become one." },
  { title: "Make the rounds.", body: "A Sunday in each home." },
];

function traveller(container: HTMLElement): HTMLElement {
  return container.querySelector<HTMLElement>("[data-way-traveller]")!;
}

function tabs(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>("[data-way-step]")];
}

describe("WayIn", () => {
  it("draws the five steps as the emblems in order, with the traveller on the first", () => {
    const { container } = render(<WayIn steps={STEPS} />);
    const marks = [...container.querySelectorAll("svg[data-gathering-mark]")].map((m) =>
      m.getAttribute("data-gathering-mark"),
    );
    expect(marks).toEqual(["one", "two", "table", "feast", "homes"]);
    const way = container.querySelector("[data-way-in]")!;
    expect(way.getAttribute("data-step")).toBe("0");
    expect(tabs(container)[0].hasAttribute("data-on")).toBe(true);
    expect(traveller(container).style.transform).toBe("translateX(0%)");
    expect(container.querySelector("[data-way-words] h3")!.textContent).toBe("Say hello.");
  });

  it("only the lit emblem gathers; the tour runs only on the last step when lit", () => {
    const { container } = render(<WayIn steps={STEPS} initial={4} />);
    const lit = [...container.querySelectorAll("svg[data-gathering-mark][data-lit]")];
    expect(lit.map((m) => m.getAttribute("data-gathering-mark"))).toEqual(["homes"]);
    expect(container.querySelectorAll("path[data-called]").length).toBe(5);
    const { container: first } = render(<WayIn steps={STEPS} />);
    expect(first.querySelectorAll("path[data-called]").length).toBe(0);
  });

  it("a step under the pointer, or tapped, stays put: only the arrows move the traveller", () => {
    const { container } = render(<WayIn steps={STEPS} />);
    fireEvent.mouseEnter(tabs(container)[2]);
    fireEvent.click(tabs(container)[3]);
    expect(container.querySelector("[data-way-in]")!.getAttribute("data-step")).toBe("0");
    expect(container.querySelectorAll("[data-way-step] button").length).toBe(0);
  });

  it("the steps walked stay bright, the current is lit, the rest wait", () => {
    const { container } = render(<WayIn steps={STEPS} initial={2} />);
    expect(traveller(container).style.transform).toBe("translateX(200%)");
    expect(container.querySelector("[data-way-words] h3")!.textContent).toBe("Dinner.");
    const ts = tabs(container);
    expect(ts[0].hasAttribute("data-walked")).toBe(true);
    expect(ts[1].hasAttribute("data-walked")).toBe(true);
    expect(ts[2].hasAttribute("data-on")).toBe(true);
    expect(ts[2].getAttribute("aria-current")).toBe("step");
    expect(ts[3].hasAttribute("data-walked")).toBe(false);
  });

  it("the diamond arrows step back and forward, and rest at the ends", () => {
    const { container } = render(<WayIn steps={STEPS} />);
    const back = container.querySelector<HTMLButtonElement>("[data-way-arrow='back']")!;
    const next = container.querySelector<HTMLButtonElement>("[data-way-arrow='next']")!;
    expect(back.disabled).toBe(true);
    expect(next.disabled).toBe(false);
    fireEvent.click(next);
    fireEvent.click(next);
    expect(container.querySelector("[data-way-in]")!.getAttribute("data-step")).toBe("2");
    expect(back.disabled).toBe(false);
    fireEvent.click(back);
    expect(container.querySelector("[data-way-in]")!.getAttribute("data-step")).toBe("1");
    for (let i = 0; i < 6; i++) fireEvent.click(next);
    expect(container.querySelector("[data-way-in]")!.getAttribute("data-step")).toBe("4");
    expect(next.disabled).toBe(true);
  });

  it("waits undrawn until shown, then the rule draws on from the left and each emblem traces after it", () => {
    const { container } = render(<WayIn steps={STEPS} shown={false} />);
    const spans = [...container.querySelectorAll<HTMLElement>("[data-way-rule] > span")];
    expect(spans.length).toBe(10);
    expect(spans.every((s) => s.style.transform === "scaleX(0)")).toBe(true);
    expect(traveller(container).style.opacity).toBe("0");
    const { container: shown } = render(<WayIn steps={STEPS} />);
    const drawn = [...shown.querySelectorAll<HTMLElement>("[data-way-rule] > span")];
    expect(drawn.map((s) => parseFloat(s.style.transitionDelay))).toEqual(
      drawn.map((_, i) => i * RULE_STAGGER_MS),
    );
    const firstLozenge = (i: number) =>
      parseFloat(
        shown.querySelectorAll<SVGPathElement>("svg[data-gathering-mark]")[i].querySelector("path")!.style
          .transitionDelay,
      );
    expect(firstLozenge(1) - firstLozenge(0)).toBe(RULE_STAGGER_MS + TRACE_STAGGER_MS);
  });
});
