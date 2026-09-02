/**
 * Telling one wheel gesture from the next. A trackpad swipe is a burst of
 * events: deltas that grow while the fingers move, then a momentum tail that
 * decays for a second or more (macOS keeps it coming until the trackpad is
 * touched again). A mouse notch is one event; a spin is a run of equal ones.
 * A gesture is new after a rest, on a reversal, or when the deltas grow again
 * out of a tail — momentum only ever shrinks. Busy frames muddy this: Chrome
 * coalesces two tail events into one twice the size, delivered after a gap.
 * So growth must hold for two events running, a rest inside a tail counts
 * only for a notch-sized delta, and while the page is busy turning (where the
 * jank is) nothing but a reversal begins a gesture.
 */

import { WHEEL_REST_MS } from "@/theme/motion";

/** a delta this many times the previous one is a rise */
const WHEEL_RISE = 1.2;
/** rises in a row, in a tail, that make a new swipe */
const WHEEL_RISES = 2;
/** px a rising delta must reach to count: keeps a tail's own jitter out */
const WHEEL_GROWTH_FLOOR = 10;
/** px an event after a rest must reach to count inside a tail: a mouse notch, not a coalesced spike */
const WHEEL_NOTCH = 50;
/** the tail begins once the deltas have fallen to this share of the gesture's peak */
const WHEEL_TAIL_RATIO = 0.5;

export type WheelGesture = {
  /** the previous event's signed delta */
  prev: number;
  /** when it arrived, ms */
  at: number;
  /** the largest delta of the gesture so far */
  peak: number;
  /** the deltas have come down off the peak: the momentum tail */
  tail: boolean;
  /** how many events running the deltas have risen */
  rises: number;
};

export const idleWheel: WheelGesture = { prev: 0, at: -Infinity, peak: 0, tail: false, rises: 0 };

/**
 * Feed one event: whether it begins a new gesture, and the state after it.
 * `busy` is the page mid-turn, when only a reversal can begin one.
 */
export function stepWheel(g: WheelGesture, delta: number, now: number, busy = false): { began: boolean; g: WheelGesture } {
  const size = Math.abs(delta);
  const rested = now - g.at > WHEEL_REST_MS && (!g.tail || size >= WHEEL_NOTCH);
  const rises = size > Math.abs(g.prev) * WHEEL_RISE ? g.rises + 1 : 0;
  const reversed = g.prev !== 0 && delta !== 0 && Math.sign(delta) !== Math.sign(g.prev);
  const grown = g.tail && size >= WHEEL_GROWTH_FLOOR && rises >= WHEEL_RISES;
  const began = reversed || (!busy && (rested || grown));
  if (began) return { began, g: { prev: delta, at: now, peak: size, tail: false, rises: 0 } };
  const peak = Math.max(g.peak, size);
  return { began, g: { prev: delta, at: now, peak, tail: g.tail || size < peak * WHEEL_TAIL_RATIO, rises } };
}

/** a wheel event's vertical delta in pixels, whatever unit it came in */
export function wheelPixels(e: { deltaY: number; deltaMode: number }, lineHeight: number, pageHeight: number): number {
  return e.deltaY * (e.deltaMode === 1 ? lineHeight : e.deltaMode === 2 ? pageHeight : 1);
}
