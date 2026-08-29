import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import SowingMark, {
  ENTER_SCALE,
  ROW_STAGGER_MS,
  ROWS,
  TILE_STAGGER_MS,
  TILES,
} from "./SowingMark";

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

  it("the seed alone is filled at rest, in the seal's red; the rest wait hollow", () => {
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
      expect(p.getAttribute("fill")).toBe("currentColor");
      expect(p.getAttribute("fill-opacity")).toBe("0");
      expect(parseFloat(p.getAttribute("stroke-opacity")!)).toBeLessThan(
        parseFloat(seedPath.getAttribute("stroke-opacity")!),
      );
    }
  });

  it("lit, the harvest fills every row in cream, a row after the next from the seed", () => {
    const { container } = render(<SowingMark lit />);
    expect(container.querySelector("svg")!.getAttribute("data-lit")).toBe("");
    const all = tiles(container);
    expect(all.every((t) => t.hasAttribute("data-on"))).toBe(true);
    const fills = all.map((t) => t.querySelector("path")!.getAttribute("fill"));
    expect(fills[0]).toBe("var(--color-seal)");
    expect(fills.slice(1).every((f) => f === "currentColor")).toBe(true);
    // the delays step by row, then by tile along the row
    const delay = (t: HTMLElement) => parseFloat(t.style.transitionDelay);
    expect(delay(all[0])).toBe(0);
    expect(delay(all[1])).toBe(ROW_STAGGER_MS);
    expect(delay(all[2])).toBe(ROW_STAGGER_MS + TILE_STAGGER_MS);
    expect(delay(all[3])).toBe(2 * ROW_STAGGER_MS);
    expect(delay(all[TILES - 1])).toBe(
      (ROWS - 1) * ROW_STAGGER_MS + (ROWS - 1) * TILE_STAGGER_MS,
    );
  });

  it("waits back along the diagonal until shown, then stands in place", () => {
    const { container, rerender } = render(<SowingMark shown={false} />);
    for (const t of tiles(container)) {
      expect(t.style.opacity).toBe("0");
      expect(t.style.transform).toContain(`scale(${ENTER_SCALE})`);
      expect(t.style.transform).toMatch(/translate\(-\S+px, -\S+px\)/);
    }
    rerender(<SowingMark shown />);
    for (const t of tiles(container)) {
      expect(t.style.opacity).toBe("1");
      expect(t.style.transform).toBe("translate(0px, 0px) scale(1)");
    }
  });
});
