import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Seal from "./Seal";

describe("Seal", () => {
  it("renders filter-free: the pre-flattened wax needs no filter pass", () => {
    const { container } = render(<Seal />);
    expect(container.querySelectorAll("filter")).toHaveLength(0);
  });

  it("draws every part of the artwork", () => {
    const { container } = render(<Seal />);
    const parts = Array.from(container.querySelectorAll("[data-seal]")).map((el) =>
      el.getAttribute("data-seal"),
    );
    expect(parts).toContain("wax");
    expect(parts).toContain("fleur");
    expect(parts).toContain("band");
    expect(parts).toContain("highlight");
  });
});

describe("Seal instances", () => {
  it("do not share paint-server ids when two are on one page", () => {
    const { container } = render(
      <>
        <Seal />
        <Seal />
      </>,
    );
    const ids = Array.from(container.querySelectorAll("radialGradient, linearGradient, clipPath")).map(
      (el) => el.id,
    );
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
