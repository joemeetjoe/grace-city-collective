import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import OrnateRule, { DRAW_MS, LOZENGE_AT_MS, LOZENGE_STAGGER_MS } from "./OrnateRule";

const lozenges = (root: HTMLElement) => root.querySelectorAll("[data-lozenge]");

describe("OrnateRule", () => {
  it("carries two lozenges at each end by default, small ones outermost", () => {
    const { container } = render(<OrnateRule />);
    const marks = lozenges(container);
    expect(marks.length).toBe(4);
    expect(Number(marks[0].getAttribute("width"))).toBeLessThan(Number(marks[1].getAttribute("width")));
    expect(Number(marks[3].getAttribute("width"))).toBeLessThan(Number(marks[2].getAttribute("width")));
    expect(container.querySelector("[data-rule-line]")).not.toBeNull();
  });

  it("can carry a finial at one end only", () => {
    expect(lozenges(render(<OrnateRule ends="end" />).container).length).toBe(2);
    expect(lozenges(render(<OrnateRule ends="start" />).container).length).toBe(2);
  });

  it("runs vertically when asked, lozenges turned with it", () => {
    const { container } = render(<OrnateRule vertical />);
    expect(container.firstElementChild!.className).toMatch(/flex-col/);
    const mark = lozenges(container)[0];
    expect(Number(mark.getAttribute("height"))).toBeGreaterThan(Number(mark.getAttribute("width")));
    expect(container.querySelector("[data-rule-line]")!.className).toMatch(/w-px/);
  });

  it("draws in currentColor so the caller sets the ink", () => {
    const { container } = render(<OrnateRule className="text-seal" />);
    expect(container.firstElementChild!.className).toMatch(/text-seal/);
    expect(container.querySelector("path")!.getAttribute("stroke")).toBe("currentColor");
  });
});

describe("OrnateRule drawing", () => {
  const line = (root: HTMLElement) => root.querySelector<HTMLElement>("[data-rule-line]")!;
  const paths = (root: HTMLElement) => Array.from(root.querySelectorAll<SVGPathElement>("[data-lozenge] path"));

  it("rests drawn by default", () => {
    const { container } = render(<OrnateRule />);
    expect(container.firstElementChild!.getAttribute("data-drawn")).toBe("true");
    expect(line(container).className).not.toMatch(/scale-x-0/);
    for (const p of paths(container)) expect(p.className.baseVal).not.toMatch(/\[stroke-dashoffset:/);
  });

  it("waits undrawn: the line at no length from its middle, each lozenge hidden along its own perimeter", () => {
    const { container } = render(<OrnateRule drawn={false} />);
    expect(container.firstElementChild!.getAttribute("data-drawn")).toBe("false");
    const l = line(container);
    expect(l.className).toMatch(/motion-safe:scale-x-0/);
    expect(l.style.transformOrigin).toBe("50% 50%");
    expect(l.style.transitionDuration).toBe(`${DRAW_MS}ms`);
    for (const p of paths(container)) {
      expect(p.className.baseVal).toMatch(/motion-safe:\[stroke-dashoffset:var\(--len\)\]/);
      const len = Number(p.style.getPropertyValue("--len"));
      expect(len).toBeGreaterThan(0);
      expect(p.style.strokeDasharray).toBe(String(len));
    }
  });

  it("draws in order: the line, then the large lozenges, then the small", () => {
    const { container } = render(<OrnateRule drawn={false} delay={100} />);
    expect(line(container).style.transitionDelay).toBe("100ms");
    const [small, large, large2, small2] = paths(container);
    expect(large.style.transitionDelay).toBe(`${100 + LOZENGE_AT_MS}ms`);
    expect(large2.style.transitionDelay).toBe(`${100 + LOZENGE_AT_MS}ms`);
    expect(small.style.transitionDelay).toBe(`${100 + LOZENGE_AT_MS + LOZENGE_STAGGER_MS}ms`);
    expect(small2.style.transitionDelay).toBe(`${100 + LOZENGE_AT_MS + LOZENGE_STAGGER_MS}ms`);
  });

  it("a corner arm's line grows from its corner, the end without a finial", () => {
    const { container: start } = render(<OrnateRule ends="start" drawn={false} />);
    expect(line(start).style.transformOrigin).toBe("100% 50%");
    const { container: end } = render(<OrnateRule ends="end" drawn={false} />);
    expect(line(end).style.transformOrigin).toBe("0% 50%");
    const { container: down } = render(<OrnateRule ends="end" vertical drawn={false} />);
    expect(line(down).style.transformOrigin).toBe("50% 0%");
    expect(line(down).className).toMatch(/motion-safe:scale-y-0/);
  });

  it("only moves where motion is welcome", () => {
    const { container } = render(<OrnateRule drawn={false} />);
    expect(line(container).className).toMatch(/motion-safe:transition-transform/);
    expect(paths(container)[0].className.baseVal).toMatch(/motion-safe:transition-\[stroke-dashoffset\]/);
  });
});
