import { describe, expect, it } from "vitest";

import { inScene, pageTarget } from "./paging";
import type { SnapLayout } from "./snap";

// six one-viewport sections at 900px, so the scene ends at the last top
const layout: SnapLayout = { tops: [0, 900, 1800, 2700, 3600, 4500], end: 4500 };

describe("inScene", () => {
  it("holds from the hero to the last section's top, with a pixel of slack", () => {
    expect(inScene(0, layout)).toBe(true);
    expect(inScene(4500, layout)).toBe(true);
    expect(inScene(4501, layout)).toBe(true);
    expect(inScene(4502, layout)).toBe(false);
  });

  it("is never true without sections", () => {
    expect(inScene(0, { tops: [], end: 0 })).toBe(false);
  });
});

describe("pageTarget", () => {
  it("steps to the next section top from a resting position", () => {
    expect(pageTarget(0, 1, layout)).toBe(900);
    expect(pageTarget(900, 1, layout)).toBe(1800);
    expect(pageTarget(900, -1, layout)).toBe(0);
  });

  it("steps from the nearest section when caught between two", () => {
    expect(pageTarget(1000, 1, layout)).toBe(1800);
    expect(pageTarget(1000, -1, layout)).toBe(0);
    expect(pageTarget(1700, -1, layout)).toBe(900);
  });

  it("has nowhere to go back to from the hero", () => {
    expect(pageTarget(0, -1, layout)).toBeNull();
  });

  it("lets go at the last section, so the long-form can take the scroll", () => {
    expect(pageTarget(4500, 1, layout)).toBeNull();
    expect(pageTarget(4501, 1, layout)).toBeNull();
    expect(pageTarget(4500, -1, layout)).toBe(3600);
  });

  it("does nothing in the long-form", () => {
    expect(pageTarget(6000, 1, layout)).toBeNull();
    expect(pageTarget(6000, -1, layout)).toBeNull();
  });

  it("does nothing without sections", () => {
    expect(pageTarget(0, 1, { tops: [], end: 0 })).toBeNull();
  });
});
