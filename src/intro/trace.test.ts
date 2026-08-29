import { describe, expect, it } from "vitest";

import { TRACE_HOLD, TRACE_MIN_SECONDS, createTrace, drawRule, ruleReach, traceReach } from "./trace";

function rule(): SVGPathElement {
  return document.createElementNS("http://www.w3.org/2000/svg", "path");
}

describe("traceReach", () => {
  it("follows whichever is further along, the time floor or the textures", () => {
    expect(traceReach(0.3, 0)).toBeCloseTo(0.3, 6);
    expect(traceReach(0.1, 0.5)).toBeCloseTo(0.5 * TRACE_HOLD, 6);
  });

  it("never closes the rule before the gate opens", () => {
    expect(traceReach(1, 1)).toBe(TRACE_HOLD);
    expect(traceReach(0, 1)).toBe(TRACE_HOLD);
  });

  it("never goes below nothing", () => {
    expect(traceReach(-1, -1)).toBe(0);
  });
});

describe("drawRule / ruleReach", () => {
  it("shows the first fraction of a unit-length path through the dash offset", () => {
    const r = rule();
    drawRule(r, 0.25);
    expect(r.getAttribute("stroke-dasharray")).toBe("1");
    expect(r.getAttribute("stroke-dashoffset")).toBe("0.75");
    expect(ruleReach(r)).toBeCloseTo(0.25, 6);
  });

  it("reads an undrawn path as nothing", () => {
    expect(ruleReach(rule())).toBe(0);
  });
});

describe("createTrace", () => {
  it("starts with nothing drawn and a paused floor of the minimum run", () => {
    const r = rule();
    const trace = createTrace(r);
    expect(ruleReach(r)).toBe(0);
    expect(trace.timeline.paused()).toBe(true);
    expect(trace.timeline.duration()).toBeCloseTo(TRACE_MIN_SECONDS, 3);
  });

  it("the floor alone draws the rule out to the hold", () => {
    const r = rule();
    const trace = createTrace(r);
    trace.timeline.progress(0.5);
    const midway = ruleReach(r);
    expect(midway).toBeGreaterThan(0);
    expect(midway).toBeLessThan(TRACE_HOLD);
    trace.timeline.progress(1);
    expect(ruleReach(r)).toBeCloseTo(TRACE_HOLD, 6);
  });

  it("the textures pull the rule ahead of the floor, and never let it fall back", () => {
    const r = rule();
    const trace = createTrace(r);
    trace.setLoaded(0.8);
    expect(ruleReach(r)).toBeCloseTo(0.8 * TRACE_HOLD, 6);
    trace.setLoaded(0.4);
    expect(ruleReach(r)).toBeCloseTo(0.8 * TRACE_HOLD, 6);
    trace.setLoaded(1);
    expect(ruleReach(r)).toBeCloseTo(TRACE_HOLD, 6);
  });

  it("copes with no rule at all", () => {
    const trace = createTrace(null);
    expect(() => {
      trace.setLoaded(1);
      trace.timeline.progress(1);
    }).not.toThrow();
  });
});
