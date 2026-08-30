import { describe, expect, it } from "vitest";

import { activeSection, type SectionBox } from "./activeSection";

const boxes: SectionBox[] = [
  { id: "hero", top: 0 },
  { id: "about", top: 900 },
  { id: "devotions", top: 1800 },
];

describe("activeSection", () => {
  it("is the section whose box holds the viewport midpoint", () => {
    expect(activeSection(450, boxes)).toBe("hero");
    expect(activeSection(1000, boxes)).toBe("about");
    expect(activeSection(2500, boxes)).toBe("devotions");
  });

  it("a boundary belongs to the section that begins there", () => {
    expect(activeSection(900, boxes)).toBe("about");
    expect(activeSection(1800, boxes)).toBe("devotions");
  });

  it("above every section it is the first; below every section the last", () => {
    expect(activeSection(-200, boxes)).toBe("hero");
    expect(activeSection(5000, boxes)).toBe("devotions");
  });

  it("a gap between sections goes to the one above it", () => {
    const gapped: SectionBox[] = [
      { id: "a", top: 0 },
      { id: "b", top: 300 },
    ];
    expect(activeSection(200, gapped)).toBe("a");
  });

  it("with no sections there is nothing to be active", () => {
    expect(activeSection(100, [])).toBeNull();
  });
});

describe("activeSection over content-sized sections", () => {
  // below lg a section is as tall as its words (#52): the tops are whatever
  // layout says, not index × viewport, and the midpoint reads them as given
  const uneven: SectionBox[] = [
    { id: "hero", top: 0 },
    { id: "about", top: 844 },
    { id: "houses", top: 1290 },
    { id: "gatherings", top: 2410 },
  ];

  it("follows the sections' own tops, however tall each is", () => {
    expect(activeSection(422, uneven)).toBe("hero");
    expect(activeSection(1000, uneven)).toBe("about");
    expect(activeSection(1300, uneven)).toBe("houses");
    expect(activeSection(2400, uneven)).toBe("houses");
    expect(activeSection(2410, uneven)).toBe("gatherings");
  });
});
