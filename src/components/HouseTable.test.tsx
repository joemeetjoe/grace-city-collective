import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HouseTable, { ENTER_STAGGER_MS, SEATS, SIDE_SEATS } from "./HouseTable";

function seats(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>("[data-seat]"));
}

function centre(el: HTMLElement): { x: number; y: number } {
  const m = el
    .parentElement!.getAttribute("transform")!
    .match(/translate\((\S+) (\S+)\)/)!;
  return { x: parseFloat(m[1]), y: parseFloat(m[2]) };
}

describe("HouseTable", () => {
  it("is decorative: a hidden svg of a long table with a dozen seats round it, all in the mark's box", () => {
    const { container } = render(<HouseTable />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("data-lit")).toBeNull();
    const table = container.querySelector("[data-table]")!;
    expect(table.getAttribute("d")!.match(/A/g)).toHaveLength(2);
    const all = seats(container);
    expect(all).toHaveLength(SEATS);
    expect(all.filter((s) => s.hasAttribute("data-on"))).toHaveLength(0);
    const paths = all.map((s) => s.querySelector("path")!);
    const d = paths[0].getAttribute("d")!;
    expect(d.match(/A/g)).toHaveLength(2);
    expect(paths.every((p) => p.getAttribute("d") === d)).toBe(true);
  });

  it("seats the head at the top, five down each side, and the foot at the bottom, round a table between", () => {
    const { container } = render(<HouseTable />);
    const named = (name: string) =>
      container.querySelector<HTMLElement>(`[data-seat=${name}]`)!;
    const head = centre(named("head"));
    const foot = centre(named("foot"));
    expect(head.x).toBe(foot.x);
    expect(head.y).toBeLessThan(foot.y);
    for (let i = 0; i < SIDE_SEATS; i++) {
      const left = centre(named(`left-${i}`));
      const right = centre(named(`right-${i}`));
      expect(left.y).toBe(right.y);
      expect(left.x).toBeLessThan(head.x);
      expect(right.x).toBeGreaterThan(head.x);
      expect(left.y).toBeGreaterThan(head.y);
      expect(left.y).toBeLessThan(foot.y);
    }
    // the seats are in order round the table, from the head
    const order = seats(container).map((s) => s.getAttribute("data-seat"));
    expect(order[0]).toBe("head");
    expect(order[SIDE_SEATS + 1]).toBe("foot");
    expect(order[1]).toBe("right-0");
    expect(order[SEATS - 1]).toBe("left-0");
  });

  it("sets the head's seat a little brighter than the rest", () => {
    const { container } = render(<HouseTable />);
    const opacity = (name: string) =>
      parseFloat(
        container
          .querySelector(`[data-seat=${name}] path`)!
          .getAttribute("stroke-opacity")!,
      );
    expect(opacity("head")).toBeGreaterThan(opacity("foot"));
    expect(opacity("head")).toBeGreaterThan(opacity("left-2"));
  });

  it("sits centred in its box, keeping the table's proportions", () => {
    const { container } = render(<HouseTable />);
    expect(
      container.querySelector("svg")!.getAttribute("preserveAspectRatio"),
    ).toBe("xMidYMid meet");
  });

  it("lit, the seats draw in to the table and fill cream, and the table fills the seal's red", () => {
    const { container } = render(<HouseTable lit />);
    expect(container.querySelector("svg")!.getAttribute("data-lit")).toBe("");
    const all = seats(container);
    expect(all.every((s) => s.hasAttribute("data-on"))).toBe(true);
    expect(
      all.every(
        (s) => s.querySelector("path")!.getAttribute("fill-opacity") === "1",
      ),
    ).toBe(true);
    const named = (name: string) =>
      container.querySelector<HTMLElement>(`[data-seat=${name}]`)!;
    // in toward the table: down for the head, up for the foot, across for the sides
    expect(named("head").style.transform).toMatch(/translate\(0px, \d/);
    expect(named("foot").style.transform).toMatch(/translate\(0px, -\d/);
    expect(named("left-0").style.transform).toMatch(/translate\(\d/);
    expect(named("right-0").style.transform).toMatch(/translate\(-\d/);
    const table = container.querySelector("[data-table]")!;
    expect(table.hasAttribute("data-on")).toBe(true);
    expect(table.getAttribute("fill")).toBe("var(--color-seal)");
    expect(table.getAttribute("fill-opacity")).toBe("1");
  });

  it("waits faded and set back from the table until shown, then the seats come in round the table from the head", () => {
    const { container } = render(<HouseTable shown={false} />);
    const all = seats(container);
    expect(all.every((s) => s.style.opacity === "0")).toBe(true);
    const named = (name: string) =>
      container.querySelector<HTMLElement>(`[data-seat=${name}]`)!;
    // back from the table: up for the head, out to the side for the sides
    expect(named("head").style.transform).toMatch(
      /translate\(0px, -.*scale\(0\.55\)/,
    );
    expect(named("left-0").style.transform).toMatch(
      /translate\(-\d.*scale\(0\.55\)/,
    );
    const delay = (i: number) => parseFloat(all[i].style.transitionDelay);
    expect(delay(0)).toBe(ENTER_STAGGER_MS);
    expect(delay(1)).toBe(2 * ENTER_STAGGER_MS);
    expect(delay(SEATS - 1)).toBe(SEATS * ENTER_STAGGER_MS);
    const table = container.querySelector<HTMLElement>("[data-table]")!;
    expect(table.style.opacity).toBe("0");
    expect(table.style.transform).toBe("scale(0.55)");
    const shown = render(<HouseTable />).container;
    expect(seats(shown)[0].style.transform).toBe(
      "translate(0px, 0px) scale(1)",
    );
  });
});
