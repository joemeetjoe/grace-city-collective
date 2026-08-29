import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import GatheringMark, { TRACE_STAGGER_MS } from "./GatheringMark";
import { lozengePath } from "./lozenge";

describe("lozengePath", () => {
  it("draws a hollow diamond half a pixel in from its extents, centred where asked", () => {
    expect(lozengePath(5, 2.5, 10, 5)).toBe("M5 0.5L9.5 2.5L5 4.5L0.5 2.5Z");
  });
});

function paths(container: HTMLElement): SVGPathElement[] {
  return [
    ...container.querySelectorAll<SVGPathElement>(
      "svg[data-gathering-mark] path",
    ),
  ];
}

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
    const ps = paths(container);
    expect(ps.length).toBe(3);
    // every path is a hairline in currentColor, hollow, so it takes the kicker's red
    for (const p of ps) {
      expect(p.getAttribute("fill-opacity")).toBe("0");
      expect(p.getAttribute("stroke")).toBe("currentColor");
    }
  });

  it("scales by the size prop while keeping its drawing box", () => {
    const { container } = render(<GatheringMark mark="feast" size={32} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("32");
    expect(svg.getAttribute("viewBox")).toBe("0 0 44 44");
  });

  it("waits untraced until shown, then traces each lozenge a beat after the last", () => {
    const waiting = paths(
      render(<GatheringMark mark="homes" shown={false} />).container,
    );
    for (const p of waiting) {
      expect(p.getAttribute("stroke-dasharray")).toBe("1");
      expect(p.getAttribute("stroke-dashoffset")).toBe("1");
      expect(p.getAttribute("pathLength")).toBe("1");
    }
    const shown = paths(render(<GatheringMark mark="homes" />).container);
    expect(
      shown.every((p) => p.getAttribute("stroke-dashoffset") === "0"),
    ).toBe(true);
    expect(shown.map((p) => parseFloat(p.style.transitionDelay))).toEqual(
      [0, 1, 2, 3, 4, 5].map((i) => i * TRACE_STAGGER_MS),
    );
  });

  it("lit, the five houses step out from the table and the table fills", () => {
    const rest = paths(render(<GatheringMark mark="homes" />).container);
    expect(rest.every((p) => p.style.transform === "none")).toBe(true);
    const { container } = render(<GatheringMark mark="homes" lit />);
    expect(container.querySelector("svg")!.hasAttribute("data-lit")).toBe(true);
    const lit = paths(container);
    const houses = lit.slice(0, 5);
    const table = lit[5];
    // the top house steps straight up; the others out along their own spokes
    expect(houses[0].style.transform).toBe("translate(0.00px, -2.50px)");
    expect(houses.every((p) => /^translate\(/.test(p.style.transform))).toBe(
      true,
    );
    expect(houses.every((p) => p.getAttribute("fill-opacity") === "0")).toBe(
      true,
    );
    expect(table.style.transform).toBe("none");
    expect(table.getAttribute("fill-opacity")).toBe("1");
  });

  it("lit, the feast's outer rings draw in and the centre fills", () => {
    const lit = paths(render(<GatheringMark mark="feast" lit />).container);
    expect(lit[0].style.transform).toBe("scale(0.72)");
    expect(lit[1].style.transform).toBe("scale(0.8)");
    expect(lit[2].style.transform).toBe("none");
    expect(lit.map((p) => p.getAttribute("fill-opacity"))).toEqual([
      "0",
      "0",
      "1",
    ]);
  });
});
