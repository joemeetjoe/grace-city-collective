import { gsap } from "@/lib/gsap";

/**
 * The loading trace: the seal-red rule around the splash's G mark draws
 * itself clockwise from the top-left corner as the scene's textures arrive.
 */

/** the rule never closes before the gate opens; it waits here, a corner short */
export const TRACE_HOLD = 0.92;
/** the floor's run: even a cached load sees the line travel this long */
export const TRACE_MIN_SECONDS = 1.2;
/** the rule's last stretch, once the textures are in */
export const TRACE_FINISH_SECONDS = 0.35;

/**
 * How much of the rule to show: whichever is further along, the time floor
 * or the textures, and never past the hold.
 */
export function traceReach(floor: number, loaded: number): number {
  const reach = Math.max(floor, loaded * TRACE_HOLD);
  return Math.min(TRACE_HOLD, Math.max(0, reach));
}

/** draw `fraction` (0–1) of a path that declares pathLength=1 */
export function drawRule(rule: SVGPathElement, fraction: number): void {
  rule.setAttribute("stroke-dasharray", "1");
  rule.setAttribute("stroke-dashoffset", String(1 - fraction));
}

/** how much of such a path is drawn */
export function ruleReach(rule: SVGPathElement): number {
  const offset = parseFloat(rule.getAttribute("stroke-dashoffset") ?? "1");
  return Number.isFinite(offset) ? 1 - offset : 0;
}

export type Trace = {
  /** the floor: a paused run from nothing to the hold; play it, scrub it, or jump it to its end */
  timeline: gsap.core.Timeline;
  /** the textures' share, 0–1 */
  setLoaded(fraction: number): void;
};

/**
 * Drive a rule from the floor timeline and the loader together. The
 * timeline's own onComplete is the "minimum elapsed" signal.
 */
export function createTrace(rule: SVGPathElement | null, vars: gsap.TimelineVars = {}): Trace {
  const state = { floor: 0, loaded: 0 };
  const draw = () => {
    if (rule) drawRule(rule, traceReach(state.floor, state.loaded));
  };
  draw();
  const timeline = gsap.timeline({ paused: true, ...vars });
  timeline.to(state, { floor: TRACE_HOLD, duration: TRACE_MIN_SECONDS, ease: "power2.out", onUpdate: draw });
  return {
    timeline,
    setLoaded(fraction) {
      state.loaded = Math.min(1, Math.max(state.loaded, fraction));
      draw();
    },
  };
}
