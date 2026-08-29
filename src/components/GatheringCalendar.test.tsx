import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import GatheringCalendar, {
  DAYS,
  ENTER_STAGGER_MS,
  WEEKS,
} from "./GatheringCalendar";

function days(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>("[data-day]"));
}

/** the day at (week, day): the days are laid out a day-row at a time */
function at(container: HTMLElement, week: number, day: number): HTMLElement {
  return days(container)[day * WEEKS + week];
}

describe("GatheringCalendar", () => {
  it("is decorative: a hidden svg of a month on its side, four weeks by seven days, under roman numerals", () => {
    const { container } = render(<GatheringCalendar />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("data-lit")).toBeNull();
    expect(days(container)).toHaveLength(WEEKS * DAYS);
    expect(
      days(container).filter((d) => d.hasAttribute("data-on")),
    ).toHaveLength(0);
    const numerals = Array.from(
      container.querySelectorAll("text:not([data-day-mark])"),
    ).map((t) => t.textContent);
    expect(numerals).toEqual(["I", "II", "III", "IV"]);
    // every day is the mark's box: two rounded corners, drawn as arcs
    const paths = days(container).map((d) => d.querySelector("path")!);
    const d = paths[0].getAttribute("d")!;
    expect(d.match(/A/g)).toHaveLength(2);
    expect(paths.every((p) => p.getAttribute("d") === d)).toBe(true);
  });

  it("sets the Sundays apart: on top, a little brighter, over a rule with seal-red lozenge finials", () => {
    const { container } = render(<GatheringCalendar />);
    const sunday = at(container, 0, 0).querySelector("path")!;
    const monday = at(container, 0, 1).querySelector("path")!;
    expect(parseFloat(sunday.getAttribute("stroke-opacity")!)).toBeGreaterThan(
      parseFloat(monday.getAttribute("stroke-opacity")!),
    );
    const rule = container.querySelector("[data-sunday-rule]")!;
    const line = rule.querySelector("line")!;
    const ruleY = parseFloat(line.getAttribute("y1")!);
    const y = (el: Element) =>
      parseFloat(
        el
          .parentElement!.getAttribute("transform")!
          .match(/translate\(\S+ (\S+)\)/)![1],
      );
    expect(y(sunday.parentElement!)).toBeLessThan(ruleY);
    expect(y(monday.parentElement!)).toBeGreaterThan(ruleY);
    const finials = rule.querySelectorAll("path");
    expect(finials).toHaveLength(2);
    expect(finials[0].getAttribute("stroke")).toBe("var(--color-seal)");
  });

  it("marks each end of the week with an S in the gutter: Sunday bright on top, Saturday quiet at the foot", () => {
    const { container } = render(<GatheringCalendar />);
    const sunday = container.querySelector<SVGTextElement>(
      "[data-day-mark=sunday]",
    )!;
    const saturday = container.querySelector<SVGTextElement>(
      "[data-day-mark=saturday]",
    )!;
    expect(sunday.textContent).toBe("S");
    expect(saturday.textContent).toBe("S");
    const rowY = (week: number, day: number) =>
      parseFloat(
        at(container, week, day)
          .parentElement!.getAttribute("transform")!
          .match(/translate\(\S+ (\S+)\)/)![1],
      );
    expect(parseFloat(sunday.getAttribute("y")!)).toBe(rowY(0, 0));
    expect(parseFloat(saturday.getAttribute("y")!)).toBe(rowY(0, DAYS - 1));
    // to the left of the first week
    const firstX = parseFloat(
      at(container, 0, 0)
        .parentElement!.getAttribute("transform")!
        .match(/translate\((\S+) /)![1],
    );
    expect(parseFloat(sunday.getAttribute("x")!)).toBeLessThan(firstX);
    expect(parseFloat(sunday.getAttribute("fill-opacity")!)).toBeGreaterThan(
      parseFloat(saturday.getAttribute("fill-opacity")!),
    );
    // the numerals are still the only other lettering
    const texts = Array.from(container.querySelectorAll("text")).map(
      (t) => t.textContent,
    );
    expect(texts.filter((t) => t !== "S")).toEqual(["I", "II", "III", "IV"]);
  });

  it("fits its box from the top, keeping the month's proportions", () => {
    const { container } = render(<GatheringCalendar />);
    expect(
      container.querySelector("svg")!.getAttribute("preserveAspectRatio"),
    ).toBe("xMidYMin meet");
  });

  it("lights the first Sunday in the seal's red for the feast", () => {
    const { container } = render(<GatheringCalendar lit="feast" />);
    expect(container.querySelector("svg")!.getAttribute("data-lit")).toBe(
      "feast",
    );
    const on = days(container).filter((d) => d.hasAttribute("data-on"));
    expect(on).toEqual([at(container, 0, 0)]);
    const path = on[0].querySelector("path")!;
    expect(path.getAttribute("fill")).toBe("var(--color-seal)");
    expect(path.getAttribute("fill-opacity")).toBe("1");
  });

  it("lights the other three Sundays cream for the house churches, and dims the week", () => {
    const { container } = render(<GatheringCalendar lit="homes" />);
    const on = days(container).filter((d) => d.hasAttribute("data-on"));
    expect(on).toEqual([
      at(container, 1, 0),
      at(container, 2, 0),
      at(container, 3, 0),
    ]);
    expect(
      on.every(
        (d) => d.querySelector("path")!.getAttribute("fill") === "currentColor",
      ),
    ).toBe(true);
    const week = at(container, 0, 1).querySelector("path")!;
    expect(parseFloat(week.getAttribute("stroke-opacity")!)).toBeLessThan(0.28);
  });

  it("waits faded and set back along the diagonal until shown, then cascades in", () => {
    const { container } = render(<GatheringCalendar shown={false} />);
    const all = days(container);
    expect(all.every((d) => d.style.opacity === "0")).toBe(true);
    expect(all[0].style.transform).toMatch(/translate\(-.*scale\(0\.55\)/);
    // one diagonal after the next: week + day
    const delay = (week: number, day: number) =>
      parseFloat(at(container, week, day).style.transitionDelay);
    expect(delay(0, 0)).toBe(0);
    expect(delay(1, 0)).toBe(ENTER_STAGGER_MS);
    expect(delay(0, 1)).toBe(ENTER_STAGGER_MS);
    expect(delay(1, 1)).toBe(2 * ENTER_STAGGER_MS);
    expect(delay(WEEKS - 1, DAYS - 1)).toBe(
      (WEEKS - 1 + DAYS - 1) * ENTER_STAGGER_MS,
    );
    const shown = render(<GatheringCalendar />).container;
    expect(days(shown)[0].style.transform).toBe("translate(0px, 0px) scale(1)");
  });
});
