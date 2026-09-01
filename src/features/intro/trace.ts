import { gsap } from "@/lib/gsap";

/**
 * The loading trace: the seal-red rule around the splash's G mark draws
 * itself clockwise from the top-left corner as the scene's textures arrive.
 */

/** the rule never closes before the gate opens; it waits here, a corner short */
export const TRACE_HOLD = 0.92;
/** the floor's run: even a cached load sees the line travel this long */
export const TRACE_MIN_SECONDS = 1.2;
/** the floor's pace: near-even around the box, so the first corner is not rushed */
export const TRACE_EASE = "power1.inOut";
/**
 * The glide's pace when the textures are ahead of the floor, as a multiple
 * of the floor's own: quicker, since there is news, but never a leap — a
 * cached load sees the line drawn, not dropped in
 */
export const TRACE_GLIDE_PACE = 1.25;

/** how long the rule takes to glide out to the textures' share from where it is */
export function glideSeconds(from: number, to: number): number {
  return (Math.max(0, to - from) * TRACE_MIN_SECONDS) / TRACE_GLIDE_PACE;
}
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

/**
 * A frame that took longer than this (texture decode, the scene coming up
 * underneath) is counted as one short frame while the splash is up, so the
 * rule never leaps across a stall: gsap's own lag smoothing, tightened from
 * its 500 ms / 33 ms default.
 */
export const STALL_THRESHOLD_MS = 100;
export const STALL_COUNTED_MS = 16;
const GSAP_LAG_DEFAULTS = [500, 33] as const;

/** tighten gsap's lag smoothing for the splash; the return puts the default back */
export function holdClockThroughStalls(): () => void {
  gsap.ticker.lagSmoothing(STALL_THRESHOLD_MS, STALL_COUNTED_MS);
  return () => gsap.ticker.lagSmoothing(...GSAP_LAG_DEFAULTS);
}

export type Trace = {
  /** the floor: a paused run from nothing to the hold; scrub it, or jump it to its end */
  timeline: gsap.core.Timeline;
  /**
   * Begin: the floor plays, and the textures' share so far — often well along
   * by the time the splash is painted — is glided out to, not jumped to.
   * Nothing moves before this is called.
   */
  start(): void;
  /** the textures' share, 0–1 */
  setLoaded(fraction: number): void;
  /** the glide toward the textures' share, while one runs */
  glide(): gsap.core.Tween | null;
  kill(): void;
};

/**
 * Drive a rule from the floor timeline and the loader together. The
 * timeline's own onComplete is the "minimum elapsed" signal.
 */
export function createTrace(rule: SVGPathElement | null, vars: gsap.TimelineVars = {}): Trace {
  const state = { floor: 0, loaded: 0 };
  let target = 0;
  let started = false;
  let glide: gsap.core.Tween | null = null;
  const draw = () => {
    if (rule) drawRule(rule, traceReach(state.floor, state.loaded));
  };
  draw();
  const timeline = gsap.timeline({ paused: true, ...vars });
  timeline.to(state, { floor: TRACE_HOLD, duration: TRACE_MIN_SECONDS, ease: TRACE_EASE, onUpdate: draw });
  const chase = () => {
    if (!started || target <= state.loaded) return;
    glide?.kill();
    // killed by hand, never overwritten: the floor tweens the same object
    glide = gsap.to(state, {
      loaded: target,
      duration: glideSeconds(state.loaded, target),
      ease: "power1.out",
      onUpdate: draw,
      onComplete: () => {
        glide = null;
      },
    });
  };
  return {
    timeline,
    start() {
      if (started) return;
      started = true;
      // a skip may have jumped the floor to its end already
      if (timeline.progress() < 1) timeline.play();
      chase();
    },
    setLoaded(fraction) {
      target = Math.min(1, Math.max(target, fraction));
      chase();
    },
    glide: () => glide,
    kill() {
      glide?.kill();
      glide = null;
      timeline.kill();
    },
  };
}
