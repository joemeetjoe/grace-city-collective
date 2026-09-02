import { describe, expect, it } from "vitest";

import { createSectionRefs } from "./sectionRefs";

describe("createSectionRefs", () => {
  it("lists the mounted sections in index order, however they mounted", () => {
    const refs = createSectionRefs();
    const [a, b, c] = [0, 1, 2].map(() => document.createElement("section"));
    refs.at(2)(c);
    refs.at(0)(a);
    expect(refs.current).toEqual([a, c]);
    refs.at(1)(b);
    expect(refs.current).toEqual([a, b, c]);
  });

  it("drops a section that unmounts (its ref called with null)", () => {
    const refs = createSectionRefs();
    const a = document.createElement("section");
    refs.at(0)(a);
    refs.at(0)(null);
    expect(refs.current).toEqual([]);
  });

  it("hands out the same callback for an index every time, so React never re-attaches it", () => {
    const refs = createSectionRefs();
    expect(refs.at(3)).toBe(refs.at(3));
    expect(refs.at(3)).not.toBe(refs.at(4));
  });
});
