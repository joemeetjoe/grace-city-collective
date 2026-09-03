import { act, render } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { countRenders, type MemoLeaf } from "@/test/countRenders";
import Tile, { type TileProps } from "./Tile";
import { AT_REST, TILE_TRANSITION, tileTransition } from "./tileGeometry";

const PROPS: TileProps = {
  cx: 10,
  cy: 20,
  d: "M0 0h4v4h-4z",
  transform: AT_REST,
  delay: "50ms",
  shown: true,
  fill: "currentColor",
  fillOpacity: 0,
  stroke: "currentColor",
  strokeOpacity: 0.28,
};

function pose(container: HTMLElement): HTMLElement {
  return container.querySelector<HTMLElement>("g > g")!;
}

describe("Tile", () => {
  it("places the path at its centre by an outer group and poses it by an inner one, both transitioning on the tile's delay", () => {
    const { container } = render(
      <svg>
        <Tile {...PROPS} className="is-on" />
      </svg>,
    );
    const outer = container.querySelector("svg > g")!;
    expect(outer).toHaveAttribute("transform", "translate(10 20)");
    const inner = pose(container);
    expect(inner).toHaveClass(TILE_TRANSITION, "is-on");
    expect(inner.getAttribute("style")).toBe(
      "transform: translate(0px, 0px) scale(1); transform-origin: center; transform-box: fill-box; transition-delay: 50ms; opacity: 1;",
    );
    const path = inner.querySelector("path")!;
    expect(path).toHaveAttribute("d", PROPS.d);
    expect(path).not.toHaveAttribute("transform");
    expect(path).toHaveAttribute("stroke-width", "1");
    expect(path).toHaveAttribute("vector-effect", "non-scaling-stroke");
    expect(path).toHaveClass(TILE_TRANSITION);
    expect(path.style.transitionDelay).toBe("50ms");
  });

  it("takes a path drawn from its corner with a transform to centre it, and a narrower transition", () => {
    const narrow = tileTransition(["opacity", "transform"]);
    const { container } = render(
      <svg>
        <Tile {...PROPS} pathTransform="translate(-2 -2)" transition={narrow} shown={false} />
      </svg>,
    );
    const path = container.querySelector("path")!;
    expect(path).toHaveAttribute("transform", "translate(-2 -2)");
    expect(path).toHaveClass(narrow);
    expect(pose(container)).toHaveClass(narrow);
    expect(pose(container).style.opacity).toBe("0");
  });

  it("is memoised: a parent re-rendering with equal props leaves it be, and its style objects hold identity", () => {
    const counter = countRenders(Tile as unknown as MemoLeaf<TileProps>);
    let bump: () => void = () => {};
    let setDelay: (d: string) => void = () => {};
    function Parent() {
      const [, setN] = useState(0);
      const [delay, setD] = useState("50ms");
      bump = () => setN((n) => n + 1);
      setDelay = setD;
      return (
        <svg>
          <Tile {...PROPS} delay={delay} />
        </svg>
      );
    }
    try {
      const { container } = render(<Parent />);
      expect(counter.renders()).toBe(1);
      const style = pose(container).getAttribute("style");
      act(() => bump());
      expect(counter.renders()).toBe(1);
      expect(pose(container).getAttribute("style")).toBe(style);
      act(() => setDelay("100ms"));
      expect(counter.renders()).toBe(2);
      expect(pose(container).style.transitionDelay).toBe("100ms");
    } finally {
      counter.restore();
    }
  });
});
