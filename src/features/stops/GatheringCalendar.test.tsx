import { render, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { STATE } from "@/theme/classes";
import { TILE_STAGGER_MS } from "@/theme/motion";
import GatheringCalendar, {
  DAYS,
  VIEW_H,
  VIEW_H_ACROSS,
  VIEW_W,
  VIEW_W_ACROSS,
  WEEKS,
} from "./GatheringCalendar";

/** the days' pose groups: each a tile posed about its own box */
function days(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('g[style*="transform-box"]'));
}

/** the day at (week, day): the days are laid out a day-row at a time */
function at(container: HTMLElement, week: number, day: number): HTMLElement {
  return days(container)[day * WEEKS + week];
}

/** the days lit for the gathering */
function lit(container: HTMLElement): HTMLElement[] {
  return days(container).filter((d) => d.classList.contains(STATE.on));
}

/** a day's centre, from the translate on its outer group */
function centreOf(container: HTMLElement, week: number, day: number) {
  const [, x, y] = at(container, week, day)
    .parentElement!.getAttribute("transform")!
    .match(/translate\((\S+) (\S+)\)/)!;
  return { x: parseFloat(x), y: parseFloat(y) };
}

/** the rule between the Sundays and the week: the one group with a line in it */
function rule(container: HTMLElement): HTMLElement {
  return container.querySelector("line")!.parentElement!;
}

/** the S marks: Sunday's first, then Saturday's */
function marks(container: HTMLElement): HTMLElement[] {
  return within(container).getAllByText("S");
}

/** the week numerals, in order */
function numerals(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>("text")).filter((t) => t.textContent !== "S");
}

describe("GatheringCalendar", () => {
  it("is decorative: a hidden svg of a month on its side, four weeks by seven days, under roman numerals", () => {
    const { container } = render(<GatheringCalendar />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).not.toHaveClass(STATE.lit);
    expect(days(container)).toHaveLength(WEEKS * DAYS);
    expect(lit(container)).toHaveLength(0);
    expect(numerals(container).map((t) => t.textContent)).toEqual(["I", "II", "III", "IV"]);
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
    const line = rule(container).querySelector("line")!;
    const ruleY = parseFloat(line.getAttribute("y1")!);
    expect(centreOf(container, 0, 0).y).toBeLessThan(ruleY);
    expect(centreOf(container, 0, 1).y).toBeGreaterThan(ruleY);
    const finials = rule(container).querySelectorAll("path");
    expect(finials).toHaveLength(2);
    expect(finials[0]).toHaveAttribute("stroke", "var(--color-seal)");
  });

  it("marks each end of the week with an S in the gutter: Sunday bright on top, Saturday quiet at the foot", () => {
    const { container } = render(<GatheringCalendar />);
    const [sunday, saturday] = marks(container);
    expect(marks(container)).toHaveLength(2);
    expect(parseFloat(sunday.getAttribute("y")!)).toBe(centreOf(container, 0, 0).y);
    expect(parseFloat(saturday.getAttribute("y")!)).toBe(centreOf(container, 0, DAYS - 1).y);
    // to the left of the first week
    expect(parseFloat(sunday.getAttribute("x")!)).toBeLessThan(centreOf(container, 0, 0).x);
    expect(parseFloat(sunday.getAttribute("fill-opacity")!)).toBeGreaterThan(
      parseFloat(saturday.getAttribute("fill-opacity")!),
    );
  });

  it("lights the first Sunday in the seal's red for the feast", () => {
    const { container } = render(<GatheringCalendar lit="feast" />);
    expect(container.querySelector("svg")).toHaveClass(STATE.lit);
    const on = lit(container);
    expect(on).toEqual([at(container, 0, 0)]);
    const path = on[0].querySelector("path")!;
    expect(path).toHaveAttribute("fill", "var(--color-seal)");
    expect(path).toHaveAttribute("fill-opacity", "1");
  });

  it("lights the other three Sundays cream for the house churches, and dims the week", () => {
    const { container } = render(<GatheringCalendar lit="homes" />);
    expect(container.querySelector("svg")).toHaveClass(STATE.lit);
    const on = lit(container);
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
    expect(delay(1, 0)).toBe(TILE_STAGGER_MS);
    expect(delay(0, 1)).toBe(TILE_STAGGER_MS);
    expect(delay(1, 1)).toBe(2 * TILE_STAGGER_MS);
    expect(delay(WEEKS - 1, DAYS - 1)).toBe(
      (WEEKS - 1 + DAYS - 1) * TILE_STAGGER_MS,
    );
    // the furniture waits with them: the numerals by week, the rule after, the S marks by day
    expect(numerals(container).every((n) => n.style.opacity === "0")).toBe(true);
    expect(parseFloat(numerals(container)[2].style.transitionDelay)).toBe(2 * TILE_STAGGER_MS);
    expect(parseFloat(rule(container).style.transitionDelay)).toBe(WEEKS * TILE_STAGGER_MS);
    expect(parseFloat(marks(container)[1].style.transitionDelay)).toBe((DAYS - 1) * TILE_STAGGER_MS);
    const shown = render(<GatheringCalendar />).container;
    expect(days(shown)[0].style.transform).toBe("translate(0px, 0px) scale(1)");
    expect(numerals(shown).every((n) => n.style.opacity === "1")).toBe(true);
  });

  it("carries no data attributes: its states are classes", () => {
    const { container } = render(<GatheringCalendar lit="homes" across />);
    for (const el of container.querySelectorAll("*")) {
      expect(el.getAttributeNames().filter((n) => n.startsWith("data-"))).toEqual([]);
    }
  });

  describe("across", () => {
    it("transposes the month for a phone card: a wide, short drawing, the days across and the weeks down, the Sundays at the left", () => {
      const { container } = render(<GatheringCalendar across />);
      const svg = container.querySelector("svg")!;
      expect(svg).toHaveAttribute("viewBox", `0 0 ${VIEW_W_ACROSS} ${VIEW_H_ACROSS}`);
      expect(VIEW_W_ACROSS).toBeGreaterThan(VIEW_H_ACROSS);
      expect(VIEW_W).toBeLessThan(VIEW_H);
      expect(days(container)).toHaveLength(WEEKS * DAYS);
      // the Sunday stands left of the Monday in its week, level with it
      const sunday = centreOf(container, 0, 0);
      const monday = centreOf(container, 0, 1);
      expect(sunday.x).toBeLessThan(monday.x);
      expect(sunday.y).toBe(monday.y);
      // the second week sits below the first, in the same column
      const nextSunday = centreOf(container, 1, 0);
      expect(nextSunday.y).toBeGreaterThan(sunday.y);
      expect(nextSunday.x).toBe(sunday.x);
      // the desktop's month is the other way up
      const upright = render(<GatheringCalendar />).container;
      expect(upright.querySelector("svg")).toHaveAttribute("viewBox", `0 0 ${VIEW_W} ${VIEW_H}`);
      expect(centreOf(upright, 0, 0).y).toBeLessThan(centreOf(upright, 0, 1).y);
    });

    it("sets the Sundays' column apart by the rule standing on end, its finials tall at either end", () => {
      const { container } = render(<GatheringCalendar across />);
      const line = rule(container).querySelector("line")!;
      const x = parseFloat(line.getAttribute("x1")!);
      expect(line.getAttribute("x2")).toBe(line.getAttribute("x1"));
      const y1 = parseFloat(line.getAttribute("y1")!);
      const y2 = parseFloat(line.getAttribute("y2")!);
      expect(y1).toBeLessThan(y2);
      expect(centreOf(container, 0, 0).x).toBeLessThan(x);
      expect(centreOf(container, 0, 1).x).toBeGreaterThan(x);
      // the rule spans the weeks, and a finial closes each end on its line
      expect(y1).toBeLessThan(centreOf(container, 0, 0).y);
      expect(y2).toBeGreaterThan(centreOf(container, WEEKS - 1, 0).y);
      const finials = Array.from(rule(container).querySelectorAll("path"));
      expect(finials).toHaveLength(2);
      const points = finials.map((f) =>
        Array.from(f.getAttribute("d")!.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)).map(
          ([, px, py]) => ({ x: parseFloat(px), y: parseFloat(py) }),
        ),
      );
      for (const lozenge of points) {
        const xs = lozenge.map((p) => p.x);
        const ys = lozenge.map((p) => p.y);
        // taller than wide, centred on the rule
        expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(
          Math.max(...xs) - Math.min(...xs),
        );
        expect((Math.max(...xs) + Math.min(...xs)) / 2).toBeCloseTo(x);
      }
      expect(Math.max(...points[0].map((p) => p.y))).toBeLessThanOrEqual(y1);
      expect(Math.min(...points[1].map((p) => p.y))).toBeGreaterThanOrEqual(y2);
    });

    it("runs the numerals down the gutter at each week's row, and stands the S over the first and last columns", () => {
      const { container } = render(<GatheringCalendar across />);
      numerals(container).forEach((n, week) => {
        expect(parseFloat(n.getAttribute("y")!)).toBe(centreOf(container, week, 0).y);
        expect(parseFloat(n.getAttribute("x")!)).toBeLessThan(
          centreOf(container, week, 0).x,
        );
      });
      const [sunday, saturday] = marks(container);
      expect(parseFloat(sunday.getAttribute("x")!)).toBe(centreOf(container, 0, 0).x);
      expect(parseFloat(saturday.getAttribute("x")!)).toBe(
        centreOf(container, 0, DAYS - 1).x,
      );
      expect(parseFloat(sunday.getAttribute("y")!)).toBeLessThan(
        centreOf(container, 0, 0).y,
      );
      expect(sunday.getAttribute("y")).toBe(saturday.getAttribute("y"));
    });

    it("keeps the month's lighting and cascade", () => {
      const { container } = render(
        <GatheringCalendar across lit="homes" shown={false} />,
      );
      expect(lit(container)).toEqual([
        at(container, 1, 0),
        at(container, 2, 0),
        at(container, 3, 0),
      ]);
      const delay = (week: number, day: number) =>
        parseFloat(at(container, week, day).style.transitionDelay);
      expect(delay(0, 0)).toBe(0);
      expect(delay(1, 1)).toBe(2 * TILE_STAGGER_MS);
    });
  });
});
