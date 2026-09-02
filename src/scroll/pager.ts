/**
 * The paging state machine, as data. Inside the scene the wheel and the
 * finger never scroll: each gesture turns to the next (or previous) section —
 * a swipe with its momentum tail is one gesture (wheelGesture.ts), a finger's
 * press-to-lift another. During a turn only a reversal is heard, and it takes
 * its turn after. At the last section a forward gesture lets go and the
 * long-form scrolls freely; coming back up, the scene takes the scroll again
 * at the last section's top. What gets past the hold (keys, a dragged
 * scrollbar, the tail of a re-entry) settles on the nearest section once it
 * rests.
 *
 * Every transition here is pure: state and inputs in, the next state and a
 * list of effects out. attachPager.ts owns the state and carries the effects
 * out — the tween, the observer, the native scroll — so the machine is
 * tested without a DOM.
 */
import { PAGE_SECONDS, SETTLE_SECONDS } from "@/theme/motion";
import { inScene, pageTarget, type PageDirection } from "./paging";
import { snapTo, type SnapLayout } from "./snap";
import { idleWheel, stepWheel, type WheelGesture } from "./wheelGesture";

/** pixels of wheel or finger before a gesture counts (a mouse notch is ~100) */
export const PAGE_TOLERANCE = 10;
/** px/s under which the scroll counts as at rest (the smoother's lerp tail runs down to this) */
export const REST_VELOCITY = 10;

/** one gesture's ask: which way, and how far it had scrolled (for the notch that lets go) */
export type Gesture = { direction: PageDirection; px: number };

export type PagerState = {
  /** the wheel is held (prevented, paged): the native position is in the scene */
  holding: boolean;
  /** a turn tween is in flight */
  turning: boolean;
  wheel: WheelGesture;
  /** the wheel gesture under way still owes a turn; its px so far */
  wheelArmed: boolean;
  wheelSum: number;
  /** the finger down still owes a turn */
  touchArmed: boolean;
  /** a gesture made during a turn waits for it: the last one made, when it ends */
  queued: Gesture | null;
};

export const idlePager: PagerState = {
  holding: false,
  turning: false,
  wheel: idleWheel,
  wheelArmed: false,
  wheelSum: 0,
  touchArmed: false,
  queued: null,
};

/** what the page is asked to do, in order */
export type PagerEffect =
  /** the wheel event is the page's: prevent its native scroll */
  | { kind: "prevent" }
  /** the touch observer takes the finger (enable) */
  | { kind: "hold" }
  /** and gives it back (disable) */
  | { kind: "release" }
  /** tween the scroll to a section top */
  | { kind: "turn"; top: number; seconds: number }
  /** scroll natively by this much: the notch that let go, into the long-form */
  | { kind: "scrollBy"; px: number }
  /** the scroll is still moving: ask again after the settle delay */
  | { kind: "retry" };

export type Step = { state: PagerState; effects: PagerEffect[] };

/** where the page is: the (smoothed) scroll position, and the scene's layout */
export type Page = { scrollY: number; layout: SnapLayout };

const step = (state: PagerState, ...effects: PagerEffect[]): Step => ({ state, effects });

function turn(state: PagerState, top: number, seconds: number): Step {
  return step({ ...state, turning: true }, { kind: "turn", top, seconds });
}

/**
 * Take the wheel: prevented and paged. Taken back mid-gesture (scrolling up
 * out of the long-form) the rest of that gesture is swallowed, so the scene
 * settles on its last section before turning; the next gesture, or a jump's,
 * counts.
 */
export function hold(state: PagerState): Step {
  return step({ ...state, holding: true, wheelArmed: false, touchArmed: false, queued: null }, { kind: "hold" });
}

/** let the wheel go: the long-form scrolls natively */
export function release(state: PagerState): Step {
  return step({ ...state, holding: false }, { kind: "release" });
}

/**
 * Hold only while the *native* position is in the scene: that is where the
 * wheel's own writes land, ahead of the smoother's lerp.
 */
export function sync(state: PagerState, nativeY: number, layout: SnapLayout): Step {
  const inside = inScene(nativeY, layout);
  if (inside && !state.holding) return hold(state);
  if (!inside && state.holding) return release(state);
  return step(state);
}

/** one gesture's turn — or, at the last section going on, the let-go */
export function gesture(state: PagerState, direction: PageDirection, px: number, page: Page): Step {
  if (state.turning) return step({ ...state, queued: { direction, px } });
  const top = pageTarget(page.scrollY, direction, page.layout);
  if (top !== null) return turn(state, top, PAGE_SECONDS);
  if (direction > 0) {
    // the last section lets go: this notch scrolls natively, and the
    // long-form takes the rest of the gesture
    const released = release(state);
    return step(released.state, ...released.effects, { kind: "scrollBy", px });
  }
  return step(state);
}

/**
 * A wheel event of `px` while holding: prevented, fed to the gesture
 * detector, and the gesture's first PAGE_TOLERANCE px ask for one turn.
 */
export function wheel(state: PagerState, px: number, now: number, page: Page): Step {
  if (!state.holding) return step(state);
  const { began, g } = stepWheel(state.wheel, px, now, state.turning);
  let next: PagerState = began ? { ...state, wheel: g, wheelArmed: true, wheelSum: 0 } : { ...state, wheel: g };
  next = { ...next, wheelSum: next.wheelSum + px };
  if (next.wheelArmed && Math.abs(next.wheelSum) >= PAGE_TOLERANCE) {
    const asked = gesture({ ...next, wheelArmed: false }, next.wheelSum > 0 ? 1 : -1, Math.abs(next.wheelSum), page);
    return step(asked.state, { kind: "prevent" }, ...asked.effects);
  }
  return step(next, { kind: "prevent" });
}

/** a finger down: one turn per press */
export function touchPress(state: PagerState): Step {
  return step({ ...state, touchArmed: true });
}

/** the finger dragged, `delta` px so far; a finger dragged up asks for what is below (direction 1) */
export function touchMove(state: PagerState, direction: PageDirection, delta: number, page: Page): Step {
  if (!state.touchArmed) return step(state);
  return gesture({ ...state, touchArmed: false }, direction, Math.abs(delta), page);
}

/** the turn tween has completed: what waited for it goes now */
export function turnEnded(state: PagerState, page: Page): Step {
  const next = state.queued;
  const rested: PagerState = { ...state, turning: false, queued: null };
  return next ? gesture(rested, next.direction, next.px, page) : step(rested);
}

/**
 * The settle, after the scroll has been quiet for SETTLE_DELAY_SECONDS:
 * once at rest (under REST_VELOCITY px/s) and off a section top, turn to the
 * nearest one.
 */
export function settle(state: PagerState, velocity: number, page: Page): Step {
  if (!state.holding || state.turning) return step(state);
  if (Math.abs(velocity) >= REST_VELOCITY) return step(state, { kind: "retry" });
  const top = snapTo(page.scrollY, page.layout);
  if (Math.abs(top - page.scrollY) >= 1) return turn(state, top, SETTLE_SECONDS);
  return step(state);
}
