import { describe, expect, it, vi } from "vitest";

import { gsap } from "@/lib/gsap";

import { TRACE_GLIDE_PACE, TRACE_MIN_SECONDS } from "@/theme/motion";
import {
  TRACE_HOLD,
  createTrace,
  drawRule,
  glideSeconds,
  holdClockThroughStalls,
  ruleReach,
  traceReach,
} from "./trace";

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

describe("glideSeconds", () => {
  it("paces the glide by distance, a fixed multiple quicker than the floor", () => {
    expect(glideSeconds(0, 1)).toBeCloseTo(TRACE_MIN_SECONDS / TRACE_GLIDE_PACE, 6);
    expect(glideSeconds(0.5, 1)).toBeCloseTo(TRACE_MIN_SECONDS / TRACE_GLIDE_PACE / 2, 6);
    expect(glideSeconds(1, 0.5)).toBe(0);
  });
});

describe("holdClockThroughStalls", () => {
  it("tightens gsap's lag smoothing, and its release restores the default", () => {
    const spy = vi.spyOn(gsap.ticker, "lagSmoothing");
    const release = holdClockThroughStalls();
    expect(spy).toHaveBeenLastCalledWith(100, 16);
    release();
    expect(spy).toHaveBeenLastCalledWith(500, 33);
    spy.mockRestore();
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

  it("nothing moves before start: the textures' share is kept, not drawn", () => {
    const r = rule();
    const trace = createTrace(r);
    trace.setLoaded(0.8);
    expect(ruleReach(r)).toBe(0);
    expect(trace.glide()).toBeNull();
    expect(trace.timeline.paused()).toBe(true);
    trace.start();
    expect(trace.timeline.paused()).toBe(false);
    // the share is glided out to from nothing, never jumped to
    expect(ruleReach(r)).toBe(0);
    const glide = trace.glide();
    expect(glide).not.toBeNull();
    expect(glide!.duration()).toBeCloseTo(glideSeconds(0, 0.8), 6);
    glide!.progress(0.5);
    const midway = ruleReach(r);
    expect(midway).toBeGreaterThan(0);
    expect(midway).toBeLessThan(0.8 * TRACE_HOLD);
    glide!.progress(1);
    expect(ruleReach(r)).toBeCloseTo(0.8 * TRACE_HOLD, 6);
    expect(trace.glide()).toBeNull();
    trace.kill();
  });

  it("the textures pull the rule ahead of the floor, and never let it fall back", () => {
    const r = rule();
    const trace = createTrace(r);
    trace.start();
    trace.setLoaded(0.8);
    trace.glide()!.progress(1);
    expect(ruleReach(r)).toBeCloseTo(0.8 * TRACE_HOLD, 6);
    trace.setLoaded(0.4);
    expect(trace.glide()).toBeNull();
    expect(ruleReach(r)).toBeCloseTo(0.8 * TRACE_HOLD, 6);
    trace.setLoaded(1);
    trace.glide()!.progress(1);
    expect(ruleReach(r)).toBeCloseTo(TRACE_HOLD, 6);
    trace.kill();
  });

  it("a start after a skip leaves the floor at its end", () => {
    const r = rule();
    const trace = createTrace(r);
    trace.timeline.progress(1);
    trace.start();
    expect(trace.timeline.progress()).toBe(1);
    expect(ruleReach(r)).toBeCloseTo(TRACE_HOLD, 6);
    trace.kill();
  });

  it("starts once", () => {
    const trace = createTrace(rule());
    trace.start();
    trace.timeline.pause();
    trace.start();
    expect(trace.timeline.paused()).toBe(true);
    trace.kill();
  });

  it("copes with no rule at all", () => {
    const trace = createTrace(null);
    expect(() => {
      trace.start();
      trace.setLoaded(1);
      trace.timeline.progress(1);
      trace.kill();
    }).not.toThrow();
  });
});
