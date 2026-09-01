import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import GMark from "./GMark";

describe("GMark", () => {
  it("renders an svg image with the accessible name", () => {
    render(<GMark />);
    expect(screen.getByRole("img", { name: "Grace City Collective mark" })).toBeTruthy();
  });

  it("keeps the logo's proportions at a px height", () => {
    const { container } = render(<GMark size={40} />);
    const svg = container.querySelector("svg")!;
    expect(svg.style.height).toBe("40px");
    expect(parseFloat(svg.style.width)).toBeCloseTo(40 * (1855 / 1976), 5);
  });

  it("accepts an em height", () => {
    const { container } = render(<GMark size="0.63em" />);
    const svg = container.querySelector("svg")!;
    expect(svg.style.height).toBe("0.63em");
    expect(svg.style.width).toMatch(/em/);
  });

  it("traces a seal-red rule around the box only when ruled", () => {
    const plain = render(<GMark />).container;
    expect(plain.querySelector("[data-g-mark-rule]")).toBeNull();
    const ruled = render(<GMark ruled />).container;
    const rule = ruled.querySelector("[data-g-mark-rule]")!;
    expect(rule.getAttribute("stroke")).toBe("var(--color-seal)");
    expect(rule.getAttribute("fill")).toBe("none");
    // the viewBox grows to hold the rule
    expect(ruled.querySelector("svg")!.getAttribute("viewBox")).not.toBe(plain.querySelector("svg")!.getAttribute("viewBox"));
  });

  it("is hidden from assistive tech when decorative", () => {
    const { container } = render(<GMark decorative />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("role")).toBeNull();
  });
});
