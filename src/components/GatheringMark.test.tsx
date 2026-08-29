import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import GatheringMark from "./GatheringMark";
import { lozengePath } from "./lozenge";

describe("lozengePath", () => {
  it("draws a hollow diamond half a pixel in from its extents, centred where asked", () => {
    expect(lozengePath(5, 2.5, 10, 5)).toBe("M5 0.5L9.5 2.5L5 4.5L0.5 2.5Z");
  });
});

describe("GatheringMark", () => {
  it("the homes mark is five lozenges in a ring about a sixth", () => {
    const { container } = render(<GatheringMark mark="homes" />);
    const svg = container.querySelector("svg[data-gathering-mark='homes']")!;
    expect(svg).not.toBeNull();
    expect(svg.querySelectorAll("path").length).toBe(6);
    expect(svg.getAttribute("aria-hidden")).toBe("true");
  });

  it("the feast mark is three lozenges nested one inside the next", () => {
    const { container } = render(<GatheringMark mark="feast" />);
    const paths = [...container.querySelectorAll("svg[data-gathering-mark='feast'] path")];
    expect(paths.length).toBe(3);
    // every path is a hairline in currentColor, hollow, so it takes the kicker's red
    for (const p of paths) {
      expect(p.getAttribute("fill")).toBe("none");
      expect(p.getAttribute("stroke")).toBe("currentColor");
    }
  });

  it("scales by the size prop while keeping its drawing box", () => {
    const { container } = render(<GatheringMark mark="feast" size={32} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("32");
    expect(svg.getAttribute("viewBox")).toBe("0 0 44 44");
  });
});
