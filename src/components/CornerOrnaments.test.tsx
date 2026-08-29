import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import CornerOrnaments, {
  ENTER_MS,
  ENTER_OFFSET,
  ENTER_SCALE,
  ENTER_STAGGER_MS,
} from "./CornerOrnaments";

const arms = (root: HTMLElement) => [
  ...root.querySelectorAll<HTMLElement>("[data-ornate-rule]"),
];

describe("CornerOrnaments", () => {
  it("draws two brackets of two arms, top-right and bottom-left, in the seal's red", () => {
    const { container } = render(<CornerOrnaments />);
    expect(container.firstElementChild!.className).toMatch(/text-seal/);
    const all = arms(container);
    expect(all.length).toBe(4);
    expect(all[0].style.right).not.toBe("");
    expect(all[0].style.top).not.toBe("");
    expect(all[2].style.left).not.toBe("");
    expect(all[2].style.bottom).not.toBe("");
  });

  it("rests in place by default", () => {
    const { container } = render(<CornerOrnaments />);
    expect(container.firstElementChild!.getAttribute("data-shown")).toBe(
      "true",
    );
    for (const arm of arms(container)) {
      expect(arm.style.opacity).toBe("1");
      expect(arm.style.transform).toBe("translate(0px, 0px) scale(1)");
    }
  });

  it("waits faded, shrunk and set back from its corners until shown, then slides home arm by arm", () => {
    const { container, rerender } = render(<CornerOrnaments shown={false} />);
    expect(container.firstElementChild!.getAttribute("data-shown")).toBe(
      "false",
    );
    const [topA, topB, bottomA, bottomB] = arms(container);
    for (const arm of [topA, topB]) {
      expect(arm.style.opacity).toBe("0");
      expect(arm.style.transform).toBe(
        `translate(${ENTER_OFFSET}px, ${-ENTER_OFFSET}px) scale(${ENTER_SCALE})`,
      );
    }
    for (const arm of [bottomA, bottomB]) {
      expect(arm.style.transform).toBe(
        `translate(${-ENTER_OFFSET}px, ${ENTER_OFFSET}px) scale(${ENTER_SCALE})`,
      );
    }
    // each arm grows from its own corner
    expect(topA.style.transformOrigin).toBe("100% 50%");
    expect(bottomB.style.transformOrigin).toBe("50% 100%");
    // the move is a transition, only where motion is welcome, and the arms come one after another
    expect(topA.className).toMatch(/motion-safe:transition/);
    expect(topA.style.transitionDuration).toBe(`${ENTER_MS}ms`);
    expect(
      [topA, topB, bottomA, bottomB].map((a) => a.style.transitionDelay),
    ).toEqual([0, 1, 2, 3].map((i) => `${i * ENTER_STAGGER_MS}ms`));
    rerender(<CornerOrnaments shown />);
    expect(topA.style.opacity).toBe("1");
    expect(topA.style.transform).toBe("translate(0px, 0px) scale(1)");
  });
});

describe("CornerOrnaments drawing", () => {
  it("each arm draws its line and lozenges on its own beat as it slides home", () => {
    const { container } = render(<CornerOrnaments shown={false} />);
    const all = arms(container);
    expect(all.map((a) => a.getAttribute("data-drawn"))).toEqual(["false", "false", "false", "false"]);
    expect(
      all.map((a) => a.querySelector<HTMLElement>("[data-rule-line]")!.style.transitionDelay),
    ).toEqual([0, 1, 2, 3].map((i) => `${i * ENTER_STAGGER_MS}ms`));
  });
});
