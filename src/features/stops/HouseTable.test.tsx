import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { STATE } from "@/theme/classes";
import { TILE_STAGGER_MS } from "@/theme/motion";
import HouseTable from "./HouseTable";
import { SEATS, SIDE_SEATS, TABLE_VIEW_H, TABLE_VIEW_W } from "./houseTableMetrics";

/** the seats' pose groups, in order round the table: each a tile posed about its own box */
function seats(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('g[style*="transform-box"]'));
}

/** a seat by its place round the table: the head, down the right, the foot, up the left */
const HEAD = 0;
const FOOT = SIDE_SEATS + 1;
const right = (i: number) => 1 + i;
const left = (i: number) => SEATS - 1 - i;

function centre(el: HTMLElement): { x: number; y: number } {
  const m = el
    .parentElement!.getAttribute("transform")!
    .match(/translate\((\S+) (\S+)\)/)!;
  return { x: parseFloat(m[1]), y: parseFloat(m[2]) };
}

/** the table: the one path drawn straight into a centring group, not through a tile */
function table(container: HTMLElement): HTMLElement {
  return container.querySelector<HTMLElement>("svg > g > g > path")!;
}

describe("HouseTable", () => {
  it("is decorative: a hidden svg of a long table with a dozen seats round it, all in the mark's box", () => {
    const { container } = render(<HouseTable />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).not.toHaveClass(STATE.lit);
    expect(table(container).getAttribute("d")!.match(/A/g)).toHaveLength(2);
    const all = seats(container);
    expect(all).toHaveLength(SEATS);
    expect(all.filter((s) => s.classList.contains(STATE.on))).toHaveLength(0);
    const paths = all.map((s) => s.querySelector("path")!);
    const d = paths[0].getAttribute("d")!;
    expect(d.match(/A/g)).toHaveLength(2);
    expect(paths.every((p) => p.getAttribute("d") === d)).toBe(true);
  });

  it("seats the head at the top, five down each side, and the foot at the bottom, round a table between", () => {
    const { container } = render(<HouseTable />);
    const all = seats(container);
    const head = centre(all[HEAD]);
    const foot = centre(all[FOOT]);
    expect(head.x).toBe(foot.x);
    expect(head.y).toBeLessThan(foot.y);
    for (let i = 0; i < SIDE_SEATS; i++) {
      const l = centre(all[left(i)]);
      const r = centre(all[right(i)]);
      expect(l.y).toBe(r.y);
      expect(l.x).toBeLessThan(head.x);
      expect(r.x).toBeGreaterThan(head.x);
      expect(l.y).toBeGreaterThan(head.y);
      expect(l.y).toBeLessThan(foot.y);
    }
    // the seats are in order round the table, from the head: down the right, up the left
    for (let i = 1; i < SIDE_SEATS; i++) {
      expect(centre(all[right(i)]).y).toBeGreaterThan(centre(all[right(i - 1)]).y);
      expect(centre(all[left(i)]).y).toBeGreaterThan(centre(all[left(i - 1)]).y);
    }
  });

  it("sets the head's seat a little brighter than the rest", () => {
    const { container } = render(<HouseTable />);
    const opacity = (seat: number) =>
      parseFloat(seats(container)[seat].querySelector("path")!.getAttribute("stroke-opacity")!);
    expect(opacity(HEAD)).toBeGreaterThan(opacity(FOOT));
    expect(opacity(HEAD)).toBeGreaterThan(opacity(left(2)));
  });

  it("lit, the seats draw in to the table and fill cream, and the table fills the seal's red", () => {
    const { container } = render(<HouseTable lit />);
    expect(container.querySelector("svg")).toHaveClass(STATE.lit);
    const all = seats(container);
    for (const s of all) expect(s).toHaveClass(STATE.on);
    expect(
      all.every(
        (s) => s.querySelector("path")!.getAttribute("fill-opacity") === "1",
      ),
    ).toBe(true);
    // in toward the table: down for the head, up for the foot, across for the sides
    expect(all[HEAD].style.transform).toMatch(/translate\(0px, \d/);
    expect(all[FOOT].style.transform).toMatch(/translate\(0px, -\d/);
    expect(all[left(0)].style.transform).toMatch(/translate\(\d/);
    expect(all[right(0)].style.transform).toMatch(/translate\(-\d/);
    const t = table(container);
    expect(t).toHaveClass(STATE.on);
    expect(t).toHaveAttribute("fill", "var(--color-seal)");
    expect(t).toHaveAttribute("fill-opacity", "1");
  });

  it("waits faded and set back from the table until shown, then the seats come in round the table from the head", () => {
    const { container } = render(<HouseTable shown={false} />);
    const all = seats(container);
    expect(all.every((s) => s.style.opacity === "0")).toBe(true);
    // back from the table: up for the head, out to the side for the sides
    expect(all[HEAD].style.transform).toMatch(/translate\(0px, -.*scale\(0\.55\)/);
    expect(all[left(0)].style.transform).toMatch(/translate\(-\d.*scale\(0\.55\)/);
    const delay = (i: number) => parseFloat(all[i].style.transitionDelay);
    expect(delay(0)).toBe(TILE_STAGGER_MS);
    expect(delay(1)).toBe(2 * TILE_STAGGER_MS);
    expect(delay(SEATS - 1)).toBe(SEATS * TILE_STAGGER_MS);
    const t = table(container);
    expect(t.style.opacity).toBe("0");
    expect(t.style.transform).toBe("scale(0.55)");
    const shown = render(<HouseTable />).container;
    expect(seats(shown)[0].style.transform).toBe(
      "translate(0px, 0px) scale(1)",
    );
  });

  it("on its side, the box turns: the long axis runs across, the head to the left", () => {
    const { container } = render(<HouseTable across />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("viewBox", `0 0 ${TABLE_VIEW_H} ${TABLE_VIEW_W}`);
    const turned = svg.querySelector(`g[transform="translate(0 ${TABLE_VIEW_W}) rotate(-90)"]`);
    expect(turned).not.toBeNull();
    expect(seats(turned as HTMLElement).length).toBe(SEATS);
    // standing, the box is tall
    const standing = render(<HouseTable />).container.querySelector("svg")!;
    expect(standing).toHaveAttribute("viewBox", `0 0 ${TABLE_VIEW_W} ${TABLE_VIEW_H}`);
    expect(TABLE_VIEW_H).toBeGreaterThan(TABLE_VIEW_W);
  });

  it("carries no data attributes: its states are classes", () => {
    const { container } = render(<HouseTable lit across />);
    for (const el of container.querySelectorAll("*")) {
      expect(el.getAttributeNames().filter((n) => n.startsWith("data-"))).toEqual([]);
    }
  });
});

describe("HouseTable class list", () => {
  it("takes its display from the caller, so a hidden-until-md caller is not also block", () => {
    const { container } = render(<HouseTable className="hidden md:block" />);
    const tokens = container.querySelector("svg")!.getAttribute("class")!.split(/\s+/);
    expect(tokens).toEqual(expect.arrayContaining(["text-cream", "hidden", "md:block"]));
    expect(tokens).not.toContain("block");
  });
});
