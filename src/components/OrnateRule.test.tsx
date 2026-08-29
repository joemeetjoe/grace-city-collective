import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import OrnateRule from "./OrnateRule";

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
