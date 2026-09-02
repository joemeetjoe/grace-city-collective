import { describe, expect, it } from "vitest";

import { PAGE_SECONDS, SETTLE_SECONDS, WHEEL_REST_MS } from "@/theme/motion";
import {
  gesture,
  hold,
  idlePager,
  PAGE_TOLERANCE,
  release,
  REST_VELOCITY,
  settle,
  sync,
  touchMove,
  touchPress,
  turnEnded,
  wheel,
  type PagerState,
  type Step,
} from "./pager";
import type { SnapLayout } from "./snap";

// six one-viewport sections at 900px; the scene ends at the last top
const layout: SnapLayout = { tops: [0, 900, 1800, 2700, 3600, 4500], end: 4500 };
const at = (scrollY: number) => ({ scrollY, layout });

const holding: PagerState = { ...idlePager, holding: true };
const kinds = (s: Step) => s.effects.map((e) => e.kind);

/** a run of wheel events, WHEEL_REST_MS apart so each begins a gesture */
function notch(state: PagerState, px: number, scrollY: number, now = 1000): Step {
  return wheel(state, px, now, at(scrollY));
}

describe("wheel paging", () => {
  it("does nothing while not holding: the long-form scrolls natively", () => {
    const s = notch(idlePager, 100, 6000);
    expect(s.effects).toEqual([]);
    expect(s.state).toEqual(idlePager);
  });

  it("a notch is prevented and turns to the next section", () => {
    const s = notch(holding, 100, 0);
    expect(s.effects).toEqual([{ kind: "prevent" }, { kind: "turn", top: 900, seconds: PAGE_SECONDS }]);
    expect(s.state.turning).toBe(true);
    expect(s.state.wheelArmed).toBe(false);
  });

  it("a notch backwards turns to the section before", () => {
    const s = notch(holding, -100, 1800);
    expect(s.effects).toContainEqual({ kind: "turn", top: 900, seconds: PAGE_SECONDS });
  });

  it("a gesture's first PAGE_TOLERANCE px ask for one turn, no matter how much follows", () => {
    // a trackpad swipe: small deltas that grow, then a momentum tail
    let s = notch(holding, 4, 0, 1000);
    expect(kinds(s)).toEqual(["prevent"]);
    expect(s.state.wheelArmed).toBe(true);
    expect(s.state.wheelSum).toBe(4);
    s = wheel(s.state, PAGE_TOLERANCE - 4, 1016, at(0));
    expect(kinds(s)).toEqual(["prevent", "turn"]);
    // the rest of the swipe, and its tail, are swallowed
    s = wheel(s.state, 80, 1032, at(0));
    s = wheel(s.state, 40, 1048, at(0));
    expect(kinds(s)).toEqual(["prevent"]);
    expect(s.state.wheelArmed).toBe(false);
  });

  it("after a rest the next event is a new gesture, and turns again", () => {
    let s = notch(holding, 100, 0, 1000);
    s = turnEnded(s.state, at(900));
    s = wheel(s.state, 100, 1000 + WHEEL_REST_MS + 1, at(900));
    expect(s.effects).toEqual([{ kind: "prevent" }, { kind: "turn", top: 1800, seconds: PAGE_SECONDS }]);
  });

  it("at the last section a forward notch lets go: release, and the notch scrolls natively", () => {
    const s = notch(holding, 100, 4500);
    expect(s.effects).toEqual([{ kind: "prevent" }, { kind: "release" }, { kind: "scrollBy", px: 100 }]);
    expect(s.state.holding).toBe(false);
    expect(s.state.turning).toBe(false);
  });

  it("at the hero a notch back goes nowhere, and holds on", () => {
    const s = notch(holding, -100, 0);
    expect(s.effects).toEqual([{ kind: "prevent" }]);
    expect(s.state.holding).toBe(true);
  });
});

describe("touch paging", () => {
  it("a press arms one turn; the drag that follows takes it", () => {
    let s = touchPress(holding);
    expect(s.effects).toEqual([]);
    expect(s.state.touchArmed).toBe(true);
    s = touchMove(s.state, 1, -120, at(0));
    expect(s.effects).toEqual([{ kind: "turn", top: 900, seconds: PAGE_SECONDS }]);
    expect(s.state.touchArmed).toBe(false);
  });

  it("a drag without a press, or the rest of a drag after its turn, does nothing", () => {
    expect(touchMove(holding, 1, -120, at(0)).effects).toEqual([]);
    let s = touchMove(touchPress(holding).state, 1, -120, at(0));
    s = touchMove(s.state, 1, -30, at(0));
    expect(s.effects).toEqual([]);
  });

  it("a drag down asks for what is above", () => {
    const s = touchMove(touchPress(holding).state, -1, 120, at(1800));
    expect(s.effects).toEqual([{ kind: "turn", top: 900, seconds: PAGE_SECONDS }]);
  });

  it("at the last section a drag up lets go by the finger's measure", () => {
    const s = touchMove(touchPress(holding).state, 1, -120, at(4500));
    expect(s.effects).toEqual([{ kind: "release" }, { kind: "scrollBy", px: 120 }]);
  });
});

describe("hold and release", () => {
  it("hold enables the observer and forgets any gesture under way", () => {
    const armed: PagerState = { ...idlePager, wheelArmed: true, wheelSum: 5, touchArmed: true, queued: { direction: 1, px: 100 } };
    const s = hold(armed);
    expect(s.effects).toEqual([{ kind: "hold" }]);
    expect(s.state).toMatchObject({ holding: true, wheelArmed: false, touchArmed: false, queued: null });
  });

  it("release disables the observer", () => {
    const s = release(holding);
    expect(s.effects).toEqual([{ kind: "release" }]);
    expect(s.state.holding).toBe(false);
  });

  it("sync holds while the native position is in the scene, and lets go past it", () => {
    expect(sync(idlePager, 0, layout).effects).toEqual([{ kind: "hold" }]);
    expect(sync(holding, 0, layout).effects).toEqual([]);
    expect(sync(holding, 4600, layout).effects).toEqual([{ kind: "release" }]);
    expect(sync(idlePager, 4600, layout).effects).toEqual([]);
  });

  it("sync holds nothing without a layout", () => {
    expect(sync(idlePager, 0, { tops: [], end: 0 }).effects).toEqual([]);
  });
});

describe("the turn queue", () => {
  it("a gesture during a turn waits; the last one made goes when the turn ends", () => {
    let s = gesture(holding, 1, 100, at(0));
    expect(kinds(s)).toEqual(["turn"]);
    s = gesture(s.state, 1, 100, at(300));
    expect(s.effects).toEqual([]);
    expect(s.state.queued).toEqual({ direction: 1, px: 100 });
    s = gesture(s.state, -1, 60, at(600));
    expect(s.state.queued).toEqual({ direction: -1, px: 60 });
    s = turnEnded(s.state, at(900));
    expect(s.effects).toEqual([{ kind: "turn", top: 0, seconds: PAGE_SECONDS }]);
    expect(s.state.queued).toBeNull();
    expect(s.state.turning).toBe(true);
  });

  it("a turn that ends with nothing queued comes to rest", () => {
    const s = turnEnded({ ...holding, turning: true }, at(900));
    expect(s.effects).toEqual([]);
    expect(s.state.turning).toBe(false);
  });

  it("a queued let-go at the last section releases when its turn comes", () => {
    let s = gesture(holding, 1, 100, at(3600));
    s = gesture(s.state, 1, 100, at(4000));
    s = turnEnded(s.state, at(4500));
    expect(s.effects).toEqual([{ kind: "release" }, { kind: "scrollBy", px: 100 }]);
  });

  it("while turning only a reversal begins a wheel gesture", () => {
    let s = notch(holding, 100, 0, 1000);
    // a rest would begin a gesture when idle; mid-turn it does not
    s = wheel(s.state, 100, 1000 + WHEEL_REST_MS + 1, at(400));
    expect(s.effects).toEqual([{ kind: "prevent" }]);
    expect(s.state.queued).toBeNull();
    s = wheel(s.state, -100, 1000 + WHEEL_REST_MS + 2, at(400));
    expect(s.state.queued).toEqual({ direction: -1, px: 100 });
  });
});

describe("settle", () => {
  it("does nothing while not holding, or while a turn is under way", () => {
    expect(settle(idlePager, 0, at(400)).effects).toEqual([]);
    expect(settle({ ...holding, turning: true }, 0, at(400)).effects).toEqual([]);
  });

  it("waits while the scroll is still moving", () => {
    expect(settle(holding, REST_VELOCITY, at(400)).effects).toEqual([{ kind: "retry" }]);
    expect(settle(holding, -REST_VELOCITY, at(400)).effects).toEqual([{ kind: "retry" }]);
  });

  it("at rest off a section top it turns to the nearest, at the settle's pace", () => {
    const s = settle(holding, 0, at(400));
    expect(s.effects).toEqual([{ kind: "turn", top: 0, seconds: SETTLE_SECONDS }]);
    expect(s.state.turning).toBe(true);
    expect(settle(holding, 0, at(500)).effects).toEqual([{ kind: "turn", top: 900, seconds: SETTLE_SECONDS }]);
  });

  it("at rest on a section top, within a pixel, it stays", () => {
    expect(settle(holding, 0, at(900)).effects).toEqual([]);
    expect(settle(holding, 0, at(900.5)).effects).toEqual([]);
  });
});
