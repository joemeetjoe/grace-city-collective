import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import SowingMark, {
  ENTER_SCALE,
  ENTER_STAGGER_MS,
  ROWS,
  TILES,
} from "./SowingMark";
import { arrives, departs, parent, STEP_MS, TRAVEL_MS } from "./sowing";

function tiles(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>("[data-tile]"));
}

/** the tile's centre, from the group that places it */
function centre(tile: HTMLElement): { x: number; y: number } {
  const m = tile.parentElement!
    .getAttribute("transform")!
    .match(/translate\((\S+) (\S+)\)/)!;
  return { x: parseFloat(m[1]), y: parseFloat(m[2]) };
}

/** the tile at (row, col): the tiles are laid out a row at a time */
function at(container: HTMLElement, row: number, col: number): HTMLElement {
  return tiles(container)[(row * (row + 1)) / 2 + col];
}

function grain(tile: HTMLElement): HTMLElement | null {
  return tile.querySelector<HTMLElement>("[data-grain]");
}

describe("SowingMark", () => {
  it("is decorative: a hidden svg of ten tiles in a triangle, one seed over rows of two, three and four", () => {
    const { container } = render(<SowingMark />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("data-lit")).toBeNull();
    const all = tiles(container);
    expect(all).toHaveLength(TILES);
    expect(TILES).toBe(10);
    // every tile is the mark's box: two rounded corners, drawn as arcs
    const paths = all.map((t) => t.querySelector("path")!);
    const d = paths[0].getAttribute("d")!;
    expect(d.match(/A/g)).toHaveLength(2);
    expect(paths.every((p) => p.getAttribute("d") === d)).toBe(true);
    // the rows widen by one, each centred under the seed
    const rows = new Map<number, number[]>();
    for (const t of all) {
      const { x, y } = centre(t);
      rows.set(y, [...(rows.get(y) ?? []), x]);
    }
    const widths = [...rows.values()].map((xs) => xs.length);
    expect(widths).toEqual([1, 2, 3, 4]);
    const seedX = centre(all[0]).x;
    for (const xs of rows.values()) {
      expect((xs[0] + xs[xs.length - 1]) / 2).toBeCloseTo(seedX);
    }
    expect(ROWS).toBe(4);
  });

  it("the seed alone is filled at rest, in the seal's red, with its grain in the middle; the rest wait hollow", () => {
    const { container } = render(<SowingMark />);
    const [seed, ...rest] = tiles(container);
    expect(seed.hasAttribute("data-seed")).toBe(true);
    expect(seed.hasAttribute("data-on")).toBe(true);
    const seedPath = seed.querySelector("path")!;
    expect(seedPath.getAttribute("fill")).toBe("var(--color-seal)");
    expect(seedPath.getAttribute("fill-opacity")).toBe("1");
    for (const t of rest) {
      expect(t.hasAttribute("data-seed")).toBe(false);
      expect(t.hasAttribute("data-on")).toBe(false);
      const p = t.querySelector("path")!;
      expect(p.getAttribute("fill")).toBe("var(--color-seal)");
      expect(p.getAttribute("fill-opacity")).toBe("0");
      expect(parseFloat(p.getAttribute("stroke-opacity")!)).toBeLessThan(
        parseFloat(seedPath.getAttribute("stroke-opacity")!),
      );
    }
    // the seed carries no grain of its own: the second row's grains wait in
    // it, visible, and every later row's wait unseen in the tile above
    expect(grain(seed)).toBeNull();
    const seedAt = centre(seed);
    for (const t of rest) {
      const g = grain(t)!;
      expect(g.getAttribute("fill")).toBe("currentColor");
      expect(g.style.animation).toBe("none");
      const self = centre(t);
      const [dx, dy] = g.style.transform
        .match(/translate\((\S+)px, (\S+)px\)/)!
        .slice(1)
        .map(parseFloat);
      const p = { x: self.x + dx, y: self.y + dy };
      // the grain waits at a tile's centre in the row above
      const above = tiles(container).find((u) => {
        const c = centre(u);
        return (
          Math.abs(c.x - p.x) < 1 && Math.abs(c.y - p.y) < 1 && c.y < self.y
        );
      });
      expect(above).toBeDefined();
      if (Math.abs(p.y - seedAt.y) < 1) expect(g.style.opacity).toBe("1");
      else expect(g.style.opacity).toBe("0");
    }
    expect(grain(at(container, 1, 0))!.style.opacity).toBe("1");
    expect(grain(at(container, 1, 1))!.style.opacity).toBe("1");
    expect(grain(at(container, 2, 0))!.style.opacity).toBe("0");
  });

  it("a grain comes down from the nearest tile above, the left one for a row's last", () => {
    expect(parent(1, 0)).toEqual({ row: 0, col: 0 });
    expect(parent(1, 1)).toEqual({ row: 0, col: 0 });
    expect(parent(2, 1)).toEqual({ row: 1, col: 1 });
    expect(parent(2, 2)).toEqual({ row: 1, col: 1 });
    expect(parent(3, 3)).toEqual({ row: 2, col: 2 });
  });

  it("lit, the grains travel a row at a time and each row fills red as they land, until they rest in the last row", () => {
    const { container } = render(<SowingMark lit />);
    expect(container.querySelector("svg")!.getAttribute("data-lit")).toBe("");
    const all = tiles(container);
    expect(all.every((t) => t.hasAttribute("data-on"))).toBe(true);
    expect(
      all.every(
        (t) => t.querySelector("path")!.getAttribute("fill") === "var(--color-seal)",
      ),
    ).toBe(true);
    // the sequence: a row sets out one step after the one before, and lands
    // a travel later; the fill waits for the landing
    expect(departs(1)).toBe(0);
    expect(departs(2)).toBe(STEP_MS);
    expect(arrives(1)).toBe(TRAVEL_MS);
    const fillDelay = (t: HTMLElement) =>
      parseFloat(t.querySelector("path")!.style.transitionDelay);
    expect(fillDelay(at(container, 0, 0))).toBe(0);
    expect(fillDelay(at(container, 1, 1))).toBe(arrives(1));
    expect(fillDelay(at(container, 2, 0))).toBe(arrives(2));
    expect(fillDelay(at(container, 3, 3))).toBe(arrives(3));
    for (let row = 1; row < ROWS; row++) {
      for (let col = 0; col <= row; col++) {
        const a = grain(at(container, row, col))!.style.animation;
        expect(a).toContain(`sow-travel ${TRAVEL_MS}ms`);
        expect(a).toContain(` ${departs(row)}ms forwards`);
        if (row < ROWS - 1) {
          expect(a).toContain(`sow-leave`);
          expect(a).toContain(` ${departs(row + 1)}ms forwards`);
        } else {
          expect(a).not.toContain("sow-leave");
        }
      }
    }
  });

  it("waits back along the diagonal until shown, then cascades in from the seed", () => {
    const { container, rerender } = render(<SowingMark shown={false} />);
    for (const t of tiles(container)) {
      expect(t.style.opacity).toBe("0");
      expect(t.style.transform).toContain(`scale(${ENTER_SCALE})`);
      expect(t.style.transform).toMatch(/translate\(-\S+px, -\S+px\)/);
      expect(t.style.transitionDelay).toBe("0ms");
    }
    rerender(<SowingMark shown />);
    for (const t of tiles(container)) {
      expect(t.style.opacity).toBe("1");
      expect(t.style.transform).toBe("translate(0px, 0px) scale(1)");
    }
    expect(at(container, 0, 0).style.transitionDelay).toBe("0ms");
    expect(at(container, 1, 1).style.transitionDelay).toBe(
      `${2 * ENTER_STAGGER_MS}ms`,
    );
    expect(at(container, 3, 3).style.transitionDelay).toBe(
      `${6 * ENTER_STAGGER_MS}ms`,
    );
  });
});
