import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { gsap } from "@/lib/gsap";
import { REST_STATE, useAppStore } from "@/state/appStore";
import { registerRevealTarget } from "@/state/revealTargets";
import { INTRO_PLAYED_KEY } from "./introKeys";
import { createIntroController, INTRO_IDLE, introGateOpen, transition, type IntroEvent, type IntroState } from "./introMachine";
import { staticSplashMarkup } from "./staticSplash";

/** the state after `events`, from idle */
const after = (...events: IntroEvent[]): IntroState => events.reduce(transition, INTRO_IDLE);

describe("introGateOpen", () => {
  it("opens only with the textures in and either the floor run or a skip", () => {
    expect(introGateOpen({ loaded: false, minimumElapsed: false, skipped: false })).toBe(false);
    expect(introGateOpen({ loaded: true, minimumElapsed: false, skipped: false })).toBe(false);
    expect(introGateOpen({ loaded: false, minimumElapsed: true, skipped: false })).toBe(false);
    expect(introGateOpen({ loaded: false, minimumElapsed: false, skipped: true })).toBe(false);
    expect(introGateOpen({ loaded: true, minimumElapsed: true, skipped: false })).toBe(true);
    expect(introGateOpen({ loaded: true, minimumElapsed: false, skipped: true })).toBe(true);
  });
});

describe("intro machine", () => {
  it("starts idle, with nothing in, and traces once started", () => {
    expect(INTRO_IDLE).toEqual({ phase: "idle", loaded: false, minimumElapsed: false, skipped: false });
    expect(after("start")).toMatchObject({ phase: "tracing" });
  });

  it("the textures in before the floor has run: keeps tracing until the floor is done, then hands off", () => {
    const loaded = after("start", "loaded");
    expect(loaded).toMatchObject({ phase: "tracing", loaded: true, minimumElapsed: false });
    expect(transition(loaded, "minimum")).toMatchObject({ phase: "handing-off", loaded: true, minimumElapsed: true });
  });

  it("the floor run before the textures are in: waits on ink until they land, then hands off", () => {
    const run = after("start", "minimum");
    expect(run).toMatchObject({ phase: "tracing", loaded: false, minimumElapsed: true });
    expect(transition(run, "loaded")).toMatchObject({ phase: "handing-off", loaded: true });
  });

  it("a skip during the trace hands off at once when the textures are in, and waits on them otherwise", () => {
    expect(after("start", "loaded", "skip")).toMatchObject({ phase: "handing-off", skipped: true });
    const early = after("start", "skip");
    expect(early).toMatchObject({ phase: "tracing", skipped: true, loaded: false });
    expect(transition(early, "loaded")).toMatchObject({ phase: "handing-off" });
  });

  it("a skip before the first frame counts too: the gate can open from idle", () => {
    expect(after("loaded", "skip")).toMatchObject({ phase: "handing-off", skipped: true });
    expect(after("skip")).toMatchObject({ phase: "idle", skipped: true });
  });

  it("a start after the gate has opened is ignored: the trace never plays under the handoff", () => {
    const off = after("loaded", "skip");
    expect(transition(off, "start")).toBe(off);
  });

  it("a skip during the handoff is ignored, as is any other input", () => {
    const off = after("start", "loaded", "minimum");
    expect(transition(off, "skip")).toBe(off);
    expect(transition(off, "loaded")).toBe(off);
    expect(transition(off, "minimum")).toBe(off);
    expect(transition(off, "start")).toBe(off);
  });

  it("the handoff lands once, into done, where nothing moves it", () => {
    const done = after("start", "loaded", "minimum", "landed");
    expect(done).toMatchObject({ phase: "done" });
    for (const event of ["start", "loaded", "minimum", "skip", "landed"] as const) {
      expect(transition(done, event)).toBe(done);
    }
  });

  it("a landing before the gate has opened is ignored", () => {
    const tracing = after("start", "loaded");
    expect(transition(tracing, "landed")).toBe(tracing);
  });

  it("hands the same state back for an input already in, so a subscriber can tell a change from a repeat", () => {
    const loaded = after("start", "loaded");
    expect(transition(loaded, "loaded")).toBe(loaded);
    expect(transition(loaded, "start")).toBe(loaded);
    const skipped = after("skip");
    expect(transition(skipped, "skip")).toBe(skipped);
  });
});

describe("createIntroController", () => {
  /** a splash root as index.html carries it, a parallax layer registered as the page registers it, and a skip target of its own */
  function stage() {
    document.body.innerHTML = `${staticSplashMarkup()}<div id="parallax"></div>`;
    const root = document.body.firstElementChild as HTMLElement;
    const parallax = document.getElementById("parallax") as HTMLElement;
    const off = registerRevealTarget("parallax", parallax);
    const skipTarget = new EventTarget();
    const controller = createIntroController({
      root,
      mark: root.querySelector("[data-g-mark]"),
      rule: root.querySelector("[data-g-mark-rule]"),
      headline: root.querySelector("h1"),
      store: useAppStore,
      skipTarget,
    });
    return { root, parallax, skipTarget, controller, off };
  }

  beforeEach(() => {
    useAppStore.setState({ ...REST_STATE, intro: true });
    window.sessionStorage.removeItem(INTRO_PLAYED_KEY);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    useAppStore.setState(REST_STATE);
    window.sessionStorage.removeItem(INTRO_PLAYED_KEY);
    document.body.innerHTML = "";
  });

  it("holds the registered parallax on ink, tightens gsap's clock, and puts both back on dispose", () => {
    const clock = vi.spyOn(gsap.ticker, "lagSmoothing");
    const { parallax, controller, off } = stage();
    expect(parallax.style.opacity).toBe("0");
    expect(clock).toHaveBeenLastCalledWith(100, 16);
    controller.dispose();
    expect(parallax.style.opacity).toBe("");
    expect(clock).toHaveBeenLastCalledWith(500, 33);
    off();
  });

  it("reads the textures off the store, opens the gate on a skip with them in, writes the session flag, and lands on the store", () => {
    const { skipTarget, controller, off } = stage();
    expect(controller.state()).toMatchObject({ phase: "idle", loaded: false });
    useAppStore.getState().setProgress(1, 2);
    useAppStore.getState().markReady();
    expect(controller.state()).toMatchObject({ phase: "idle", loaded: true });
    expect(window.sessionStorage.getItem(INTRO_PLAYED_KEY)).toBeNull();
    skipTarget.dispatchEvent(new Event("pointerdown"));
    expect(controller.state()).toMatchObject({ phase: "handing-off", skipped: true });
    expect(controller.trace.timeline.progress()).toBe(1);
    expect(window.sessionStorage.getItem(INTRO_PLAYED_KEY)).toBe("1");
    const handoff = controller.handoff()!;
    expect(useAppStore.getState().intro).toBe(true);
    handoff.progress(1);
    expect(controller.state().phase).toBe("done");
    expect(useAppStore.getState()).toMatchObject({ intro: false, introPlayed: true });
    controller.dispose();
    off();
  });

  it("dispose mid-handoff jumps the handoff to its end, so the page is where it expects to be", () => {
    const { parallax, skipTarget, controller, off } = stage();
    useAppStore.getState().markReady();
    skipTarget.dispatchEvent(new Event("keydown"));
    const handoff = controller.handoff()!;
    handoff.progress(0.5);
    controller.dispose();
    expect(handoff.progress()).toBe(1);
    // the store was told on the way (the landing is the timeline's own completion)
    expect(useAppStore.getState().intro).toBe(false);
    expect(parallax.style.opacity).toBe("");
    off();
  });

  it("stops listening for the skip once the gate has opened, and on dispose", () => {
    const { skipTarget, controller, off } = stage();
    const remove = vi.spyOn(skipTarget, "removeEventListener");
    useAppStore.getState().markReady();
    skipTarget.dispatchEvent(new Event("wheel"));
    expect(remove).toHaveBeenCalled();
    remove.mockClear();
    controller.dispose();
    expect(remove).toHaveBeenCalled();
    off();
  });
});
