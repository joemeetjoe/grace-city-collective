import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { site } from "@/content/site";
import { STOPS } from "./registry";
import Scene from "./Scene";

describe("the scene registry (#121)", () => {
  it("keeps a stop for every scene section, and no other", () => {
    expect(Object.keys(STOPS).sort()).toEqual(site.scene.map((s) => s.id).sort());
  });

  it("renders each section through its own stop, in the section's own element", () => {
    for (const s of site.scene) {
      const { container, unmount } = render(<Scene section={s} />);
      const section = container.querySelector(`section#${s.id}`)!;
      expect(section).not.toBeNull();
      expect(section.getAttribute("data-screen-label")).toBe(s.label);
      // the about layout carries the shared-life ornament; house churches
      // has its own stop now, with the table
      if (s.id === "house-churches") {
        expect(section.querySelector("[data-house-churches-table]")).not.toBeNull();
        expect(section.querySelector("[data-about-shared-life]")).toBeNull();
      }
      if (s.id === "about") {
        expect(section.querySelector("[data-about-shared-life]")).not.toBeNull();
        expect(section.querySelector("[data-house-churches-table]")).toBeNull();
      }
      unmount();
    }
  });
});
