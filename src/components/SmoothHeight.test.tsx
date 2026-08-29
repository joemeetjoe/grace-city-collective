import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import SmoothHeight from "./SmoothHeight";

describe("SmoothHeight", () => {
  it("is the content's own height until it can measure, and passes its props to the block", () => {
    const { container } = render(
      <SmoothHeight className="pt-1" style={{ ["--i" as string]: 2 }}>
        <p>words</p>
      </SmoothHeight>,
    );
    const el = container.querySelector<HTMLElement>("[data-smooth-height]")!;
    // jsdom has no ResizeObserver: nothing is measured, so nothing is fixed
    expect(el.style.height).toBe("auto");
    expect(el.className).toContain("pt-1");
    expect(el.className).toContain("overflow-hidden");
    expect(el.style.getPropertyValue("--i")).toBe("2");
    expect(el.textContent).toBe("words");
  });
});
