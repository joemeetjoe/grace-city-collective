import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { STATE } from "@/theme/classes";
import { TILE_STAGGER_MS } from "@/theme/motion";
import SharedLife, { HUDDLE_SCALE, ROWS, VIEW_H, VIEW_H_2, VIEW_W, VIEW_W_2 } from "./SharedLife";

/** the slots' pose groups in drawing order: the heart last */
function drawn(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('g[style*="transform-box"]'));
}

/** the slots by row: the heart (row 0) is drawn last */
function slots(container: HTMLElement): HTMLElement[] {
  const all = drawn(container);
  return [all[all.length - 1], ...all.slice(0, -1)];
}

function slot(container: HTMLElement, row: number): HTMLElement {
  return slots(container)[row];
}

function lines(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>("line"));
}

function shift(el: HTMLElement): { x: number; y: number } {
  const m = el.style.transform.match(/translate\((\S+)px, (\S+)px\)/)!;
  return { x: parseFloat(m[1]), y: parseFloat(m[2]) };
}

function at(container: HTMLElement, row: number): { x: number; y: number } {
  const m = slot(container, row)
    .parentElement!.getAttribute("transform")!
    .match(/translate\((\S+) (\S+)\)/)!;
  return { x: parseFloat(m[1]), y: parseFloat(m[2]) };
}

describe("SharedLife", () => {
  it("is decorative: a hidden svg of a dozen rows, each a slot in the mark's box with a line beside it", () => {
    const { container } = render(<SharedLife />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).not.toHaveClass(STATE.lit);
    const all = slots(container);
    expect(all).toHaveLength(ROWS);
    expect(all.filter((s) => s.classList.contains(STATE.on))).toHaveLength(0);
    const paths = all.map((s) => s.querySelector("path")!);
    const d = paths[0].getAttribute("d")!;
    expect(d.match(/A/g)).toHaveLength(2);
    expect(paths.every((p) => p.getAttribute("d") === d)).toBe(true);
    const ls = lines(container);
    expect(ls).toHaveLength(ROWS);
    expect(ls.every((l) => l.style.opacity === "1")).toBe(true);
    // each line runs from beside its row's slot, level with it
    ls.forEach((l, row) => {
      expect(parseFloat(l.getAttribute("y1")!)).toBe(at(container, row).y);
      expect(parseFloat(l.getAttribute("x1")!)).toBeGreaterThan(at(container, row).x);
    });
  });

  it("at rest the slots stand in one column down the page, in place, with the first row's a little brighter", () => {
    const { container } = render(<SharedLife />);
    for (let row = 1; row < ROWS; row++) {
      expect(at(container, row).x).toBe(at(container, 0).x);
      expect(at(container, row).y).toBeGreaterThan(at(container, row - 1).y);
    }
    expect(slot(container, 3).style.transform).toBe(
      "translate(0px, 0px) scale(1)",
    );
    const opacity = (row: number) =>
      parseFloat(
        slot(container, row)
          .querySelector("path")!
          .getAttribute("stroke-opacity")!,
      );
    expect(opacity(0)).toBeGreaterThan(opacity(1));
    expect(opacity(1)).toBe(opacity(ROWS - 1));
  });

  it("lit, the lines fade and the slots leave their rows to huddle up the column, the first row's at the heart in the seal's red", () => {
    const { container } = render(<SharedLife lit />);
    expect(container.querySelector("svg")).toHaveClass(STATE.lit);
    const all = slots(container);
    for (const s of all) expect(s).toHaveClass(STATE.on);
    expect(lines(container).every((l) => l.style.opacity === "0")).toBe(true);
    // every slot moves right off its column; the top row comes down a little, the bottom rows come far up
    expect(all.every((s) => shift(s).x > 0)).toBe(true);
    expect(shift(slot(container, 0)).y).toBeGreaterThan(0);
    expect(shift(slot(container, ROWS - 1)).y).toBeLessThan(0);
    expect(-shift(slot(container, ROWS - 1)).y).toBeGreaterThan(
      shift(slot(container, 0)).y,
    );
    // and every slot grows as it goes
    expect(
      all.every((s) => s.style.transform.endsWith(`scale(${HUDDLE_SCALE})`)),
    ).toBe(true);
    // the heart lands dead centre; the rest gather round it, none as far as a row apart
    const heart = slot(container, 0);
    const heartPath = heart.querySelector("path")!;
    expect(heartPath).toHaveAttribute("fill", "var(--color-seal)");
    expect(heartPath).toHaveAttribute("fill-opacity", "1");
    const others = all.filter((s) => s !== heart);
    expect(
      others.every(
        (s) => s.querySelector("path")!.getAttribute("fill") === "currentColor",
      ),
    ).toBe(true);
    const faint = parseFloat(
      others[0].querySelector("path")!.getAttribute("fill-opacity")!,
    );
    expect(faint).toBeGreaterThan(0);
    expect(faint).toBeLessThan(0.3);
    // the heart is drawn last, so its red sits over the others' cream
    const order = drawn(container);
    expect(order[order.length - 1]).toBe(heart);
  });

  it("waits faded and up from its lines until shown, then prints in one row after the next from the top", () => {
    const { container } = render(<SharedLife shown={false} />);
    const all = slots(container);
    expect(all.every((s) => s.style.opacity === "0")).toBe(true);
    expect(slot(container, 0).style.transform).toMatch(
      /translate\(0px, -\d.*scale\(0\.55\)/,
    );
    const delay = (row: number) =>
      parseFloat(slot(container, row).style.transitionDelay);
    expect(delay(0)).toBe(TILE_STAGGER_MS);
    expect(delay(1)).toBe(2 * TILE_STAGGER_MS);
    expect(delay(ROWS - 1)).toBe(ROWS * TILE_STAGGER_MS);
    const ls = lines(container);
    expect(ls.every((l) => l.style.opacity === "0")).toBe(true);
    expect(ls[0].style.transform).toMatch(/translateY\(-\d/);
  });

  it("in two columns the rows run six and six side by side, in a wider, shorter box", () => {
    const { container } = render(<SharedLife columns={2} />);
    const svg = container.querySelector("svg")!;
    expect(VIEW_W_2).toBeGreaterThan(2 * VIEW_W);
    expect(VIEW_H_2).toBeLessThan(VIEW_H / 2 + 1);
    expect(svg).toHaveAttribute("viewBox", `0 0 ${VIEW_W_2} ${VIEW_H_2}`);
    expect(slots(container)).toHaveLength(ROWS);
    // the seventh row starts the second column: level with the first, well to its right
    expect(at(container, 6).y).toBe(at(container, 0).y);
    expect(at(container, 6).x).toBeGreaterThan(VIEW_W);
    expect(at(container, 5).y).toBeGreaterThan(at(container, 4).y);
    // one column is the tall box
    const one = render(<SharedLife />).container.querySelector("svg")!;
    expect(one).toHaveAttribute("viewBox", `0 0 ${VIEW_W} ${VIEW_H}`);
  });

  it("carries no data attributes: its states are classes", () => {
    const { container } = render(<SharedLife lit columns={2} />);
    for (const el of container.querySelectorAll("*")) {
      expect(el.getAttributeNames().filter((n) => n.startsWith("data-"))).toEqual([]);
    }
  });
});

describe("SharedLife class list", () => {
  it("takes its display from the caller, so a hidden-until-md caller is not also block", () => {
    const { container } = render(<SharedLife className="hidden md:block" />);
    const tokens = container.querySelector("svg")!.getAttribute("class")!.split(/\s+/);
    expect(tokens).toEqual(expect.arrayContaining(["text-cream", "hidden", "md:block"]));
    expect(tokens).not.toContain("block");
  });
});
