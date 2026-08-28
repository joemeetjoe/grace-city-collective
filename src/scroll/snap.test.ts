import { describe, expect, it } from "vitest";

import { documentTop, snapProgress, snapTo, type SnapLayout } from "./snap";

// six one-viewport sections at 900px, so the scene ends at the last top
const layout: SnapLayout = { tops: [0, 900, 1800, 2700, 3600, 4500], end: 4500 };

describe("snapTo", () => {
  it("settles on the nearest section top inside the scene", () => {
    expect(snapTo(100, layout)).toBe(0);
    expect(snapTo(500, layout)).toBe(900);
    expect(snapTo(2600, layout)).toBe(2700);
    expect(snapTo(4400, layout)).toBe(4500);
  });

  it("is a fixed point on a section top", () => {
    for (const top of layout.tops) expect(snapTo(top, layout)).toBe(top);
  });

  it("the exact midpoint rounds forward, so a half-scrolled section advances", () => {
    expect(snapTo(450, layout)).toBe(900);
  });

  it("leaves the long-form alone: past the scene end the input comes back unchanged", () => {
    expect(snapTo(4501, layout)).toBe(4501);
    expect(snapTo(7000, layout)).toBe(7000);
  });

  it("does nothing without waypoints", () => {
    expect(snapTo(321, { tops: [], end: 0 })).toBe(321);
  });
});

describe("snapProgress", () => {
  // ScrollTrigger hands over progress through the scene trigger (0..1)
  it("maps trigger progress to the nearest waypoint's progress", () => {
    const start = 0;
    expect(snapProgress(0.05, start, layout)).toBeCloseTo(0);
    expect(snapProgress(0.15, start, layout)).toBeCloseTo(0.2);
    expect(snapProgress(1, start, layout)).toBeCloseTo(1);
  });

  it("returns the input unchanged when the trigger has no span", () => {
    expect(snapProgress(0.4, 0, { tops: [0], end: 0 })).toBe(0.4);
  });

  it("respects a trigger that starts below the document top", () => {
    const shifted: SnapLayout = { tops: [200, 1100], end: 1100 };
    expect(snapProgress(0.9, 200, shifted)).toBeCloseTo(1);
    expect(snapProgress(0.1, 200, shifted)).toBeCloseTo(0);
  });
});

describe("documentTop", () => {
  it("sums offsetTop up the offsetParent chain, ignoring transforms", () => {
    const outer = document.createElement("div");
    const inner = document.createElement("section");
    outer.appendChild(inner);
    document.body.appendChild(outer);
    Object.defineProperty(outer, "offsetTop", { value: 400 });
    Object.defineProperty(outer, "offsetParent", { value: document.body });
    Object.defineProperty(inner, "offsetTop", { value: 50 });
    Object.defineProperty(inner, "offsetParent", { value: outer });
    expect(documentTop(inner)).toBe(450);
    outer.remove();
  });
});
