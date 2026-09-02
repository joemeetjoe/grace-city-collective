import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { site } from "@/content/site";
import * as table from "./HouseTable";
import { STOPS } from "./registry";
import * as life from "./SharedLife";
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
      const drawing = (w: number, h: number) =>
        Array.from(section.querySelectorAll("svg")).find((svg) => svg.getAttribute("viewBox") === `0 0 ${w} ${h}`) ?? null;
      if (s.id === "house-churches") {
        expect(drawing(table.VIEW_W, table.VIEW_H)).not.toBeNull();
        expect(drawing(life.VIEW_W, life.VIEW_H)).toBeNull();
      }
      if (s.id === "about") {
        expect(drawing(life.VIEW_W, life.VIEW_H)).not.toBeNull();
        expect(drawing(table.VIEW_W, table.VIEW_H)).toBeNull();
      }
      unmount();
    }
  });
});
