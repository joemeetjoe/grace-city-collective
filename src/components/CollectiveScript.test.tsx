import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { COLLECTIVE_TAIL } from "./collectiveScriptMetrics";
import CollectiveScript, { COLLECTIVE_BASELINE, COLLECTIVE_STROKE, COLLECTIVE_VIEWBOX } from "./CollectiveScript";

describe("CollectiveScript", () => {
  it("renders an img with the accessible name Collective", () => {
    render(<CollectiveScript />);
    expect(screen.getByRole("img", { name: "Collective" })).toBeTruthy();
  });

  it("draws the script as one stroked path, not filled outlines", () => {
    const { container } = render(<CollectiveScript />);
    const paths = container.querySelectorAll("path");
    expect(paths).toHaveLength(1);
    const path = paths[0];
    expect(path.getAttribute("data-script")).toBe("collective");
    expect(path.getAttribute("fill")).toBe("none");
    expect(path.getAttribute("stroke")).toBe("currentColor");
    expect(Number(path.getAttribute("stroke-width"))).toBe(COLLECTIVE_STROKE);
    expect(COLLECTIVE_STROKE).toBeGreaterThan(0);
    expect(path.getAttribute("stroke-linecap")).toBe("round");
    expect(path.getAttribute("stroke-linejoin")).toBe("round");
    expect(path.hasAttribute("vector-effect")).toBe(false);
  });

  it("is one continuous stroke plus at most a t-bar and an i-dot, in drawing order", () => {
    const { container } = render(<CollectiveScript />);
    const d = container.querySelector("path")!.getAttribute("d")!;
    const commandsPerSubpath = subpathCommandCounts(d);

    expect(commandsPerSubpath.length).toBeGreaterThanOrEqual(1);
    expect(commandsPerSubpath.length).toBeLessThanOrEqual(3);
    const [main, ...marks] = commandsPerSubpath;
    // ten connected letters take dozens of curves; a crossbar or dot takes one or two
    expect(main).toBeGreaterThanOrEqual(20);
    for (const mark of marks) expect(mark).toBeLessThanOrEqual(4);
  });

  it("exposes the box the lockup sizes against, with the baseline inside it", () => {
    const { container } = render(<CollectiveScript />);
    const svg = container.querySelector("svg")!;
    const { width, height } = COLLECTIVE_VIEWBOX;

    expect(svg.getAttribute("viewBox")).toBe(`0 0 ${width} ${height}`);
    expect(svg.getAttribute("preserveAspectRatio")).toBe("xMinYMid meet");
    expect(svg.getAttribute("overflow")).toBe("visible");
    expect(COLLECTIVE_BASELINE).toBeGreaterThan(0);
    expect(COLLECTIVE_BASELINE).toBeLessThan(height);
  });
});

/** counts the drawing commands (everything after the M) in each M-started subpath */
function subpathCommandCounts(d: string): number[] {
  const commands = d.match(/[MmLlHhVvCcSsQqTtAaZz]/g) ?? [];
  const counts: number[] = [];
  for (const c of commands) {
    if (c === "M" || c === "m") counts.push(0);
    else counts[counts.length - 1] += 1;
  }
  return counts;
}

describe("CollectiveScript tail", () => {
  it("records where the main stroke lifts off, so the seal can sit on its line", () => {
    const { container } = render(<CollectiveScript />);
    const d = container.querySelector("path")!.getAttribute("d")!;
    const main = d.split(/(?=M)/).filter((s) => s.trim())[0];
    const nums = main.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
    expect(nums.slice(-2)).toEqual([COLLECTIVE_TAIL.x, COLLECTIVE_TAIL.y]);
  });
});
