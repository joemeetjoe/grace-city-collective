import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import SharedLife, { ENTER_STAGGER_MS, HUDDLE_SCALE, ROWS } from "./SharedLife";

function slots(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>("[data-slot]"));
}

function slot(container: HTMLElement, row: number): HTMLElement {
  return container.querySelector<HTMLElement>(`[data-slot="${row}"]`)!;
}

function shift(el: HTMLElement): { x: number; y: number } {
  const m = el.style.transform.match(/translate\((\S+)px, (\S+)px\)/)!;
  return { x: parseFloat(m[1]), y: parseFloat(m[2]) };
}

describe("SharedLife", () => {
  it("is decorative: a hidden svg of a dozen rows, each a slot in the mark's box with a line beside it", () => {
    const { container } = render(<SharedLife />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("data-lit")).toBeNull();
    const all = slots(container);
    expect(all).toHaveLength(ROWS);
    expect(all.filter((s) => s.hasAttribute("data-on"))).toHaveLength(0);
    const paths = all.map((s) => s.querySelector("path")!);
    const d = paths[0].getAttribute("d")!;
    expect(d.match(/A/g)).toHaveLength(2);
    expect(paths.every((p) => p.getAttribute("d") === d)).toBe(true);
    const lines = container.querySelectorAll<HTMLElement>("[data-line]");
    expect(lines).toHaveLength(ROWS);
    expect(Array.from(lines).every((l) => l.style.opacity === "1")).toBe(true);
  });

  it("at rest the slots stand in one column down the page, in place, with the first row's a little brighter", () => {
    const { container } = render(<SharedLife />);
    const at = (row: number) => {
      const m = slot(container, row)
        .parentElement!.getAttribute("transform")!
        .match(/translate\((\S+) (\S+)\)/)!;
      return { x: parseFloat(m[1]), y: parseFloat(m[2]) };
    };
    for (let row = 1; row < ROWS; row++) {
      expect(at(row).x).toBe(at(0).x);
      expect(at(row).y).toBeGreaterThan(at(row - 1).y);
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
    expect(container.querySelector("svg")!.getAttribute("data-lit")).toBe("");
    const all = slots(container);
    expect(all.every((s) => s.hasAttribute("data-on"))).toBe(true);
    const lines = container.querySelectorAll<HTMLElement>("[data-line]");
    expect(Array.from(lines).every((l) => l.style.opacity === "0")).toBe(true);
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
    expect(heartPath.getAttribute("fill")).toBe("var(--color-seal)");
    expect(heartPath.getAttribute("fill-opacity")).toBe("1");
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
    expect(all[all.length - 1]).toBe(heart);
  });

  it("sits centred in its box, keeping the column's proportions", () => {
    const { container } = render(<SharedLife />);
    expect(
      container.querySelector("svg")!.getAttribute("preserveAspectRatio"),
    ).toBe("xMidYMid meet");
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
    expect(delay(0)).toBe(ENTER_STAGGER_MS);
    expect(delay(1)).toBe(2 * ENTER_STAGGER_MS);
    expect(delay(ROWS - 1)).toBe(ROWS * ENTER_STAGGER_MS);
    const lines = container.querySelectorAll<HTMLElement>("[data-line]");
    expect(Array.from(lines).every((l) => l.style.opacity === "0")).toBe(true);
    expect(lines[0].style.transform).toMatch(/translateY\(-\d/);
  });
});
