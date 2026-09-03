import { describe, expect, it } from "vitest";

import { HOLD } from "@/engine/tuning";
import { WAYPOINTS, smoothstep01, waypointSpan } from "@/engine/waypoints";

describe("the waypoint table", () => {
  it("has one frame per scene stop, each a band with its top above its foot", () => {
    expect(WAYPOINTS).toHaveLength(6);
    for (const wp of WAYPOINTS) expect(wp.band[0]).toBeLessThan(wp.band[1]);
  });

  it("aims only the visit stop at the dove, with a portrait seat of its own", () => {
    const aimed = WAYPOINTS.filter((wp) => wp.aim === "dove");
    expect(aimed).toEqual([WAYPOINTS.at(-1)]);
    expect(aimed[0].atPortrait).toBeGreaterThan(aimed[0].at ?? 0);
  });
});

describe("waypointSpan", () => {
  it("holds a section's own frame through its first half", () => {
    expect(waypointSpan(0)).toEqual({ from: 0, to: 1, t: 0 });
    expect(waypointSpan(HOLD)).toEqual({ from: 0, to: 1, t: 0 });
    expect(waypointSpan(2.25)).toEqual({ from: 2, to: 3, t: 0 });
  });

  it("eases to the next frame through the second half, arriving exactly at the boundary", () => {
    const mid = waypointSpan((1 + HOLD) / 2 + 1);
    expect(mid.from).toBe(1);
    expect(mid.to).toBe(2);
    expect(mid.t).toBeCloseTo(0.5, 9);
    expect(waypointSpan(1.999).t).toBeCloseTo(1, 3);
    expect(waypointSpan(2)).toEqual({ from: 2, to: 3, t: 0 });
  });

  it("clamps past the table to the last waypoint, where the travel goes nowhere", () => {
    const last = WAYPOINTS.length - 1;
    const past = waypointSpan(last + 0.9);
    expect(past).toMatchObject({ from: last, to: last });
    expect(past.t).toBeCloseTo(smoothstep01((0.9 - HOLD) / (1 - HOLD)), 9);
    expect(waypointSpan(last + 5)).toEqual({ from: last, to: last, t: 1 });
  });

  it("takes another table's length", () => {
    expect(waypointSpan(3.75, 3)).toEqual({ from: 2, to: 2, t: 1 });
  });
});

describe("smoothstep01", () => {
  it("is the Hermite ease, clamped", () => {
    expect(smoothstep01(-1)).toBe(0);
    expect(smoothstep01(0.5)).toBe(0.5);
    expect(smoothstep01(2)).toBe(1);
    expect(smoothstep01(0.25)).toBeCloseTo(0.15625, 9);
  });
});
