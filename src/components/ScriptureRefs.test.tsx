import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ScriptureRefs, { splitRefs } from "./ScriptureRefs";

describe("splitRefs", () => {
  it("splits passages on semicolons and trims them", () => {
    expect(splitRefs("Acts 2:45, 4:34; 2 Corinthians 8:2, 9:6-12")).toEqual([
      "Acts 2:45, 4:34",
      "2 Corinthians 8:2, 9:6-12",
    ]);
  });

  it("keeps a single passage whole and drops empty parts", () => {
    expect(splitRefs("Matthew 22:36-40")).toEqual(["Matthew 22:36-40"]);
    expect(splitRefs("Acts 2:42; ")).toEqual(["Acts 2:42"]);
  });
});

describe("ScriptureRefs", () => {
  it("puts a hollow lozenge between passages, none before the first", () => {
    const { container } = render(<ScriptureRefs refs="Acts 2:42-46; Acts 4:32; Luke 11:1" />);
    const marks = container.querySelectorAll("[data-ref-lozenge]");
    expect(marks.length).toBe(2);
    expect(container.textContent).toBe("Acts 2:42-46Acts 4:32Luke 11:1");
    expect(container.querySelector("path")!.getAttribute("stroke")).toBe("currentColor");
    expect(container.firstElementChild!.querySelector("[data-ref-lozenge]")).toBeNull();
  });

  it("draws no lozenge for a lone passage", () => {
    const { container } = render(<ScriptureRefs refs="Matthew 22:36-40" />);
    expect(container.querySelectorAll("[data-ref-lozenge]").length).toBe(0);
  });
});
