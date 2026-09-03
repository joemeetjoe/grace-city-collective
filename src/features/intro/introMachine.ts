import { gsap } from "@/lib/gsap";
import type { useAppStore } from "@/state/appStore";
import { buildHandoff, navMark } from "./handoff";
import { listenForSkip, markIntroPlayed } from "./introPolicy";
import { parallaxLayers } from "./restingFade";
import { createTrace, holdClockThroughStalls, type Trace } from "./trace";

/**
 * The intro as a state machine. The pure half (the state, the transitions)
 * says what the splash does with each input; the controller below runs it
 * against the DOM, gsap and the store, and owns everything that used to be
 * spread over IntroSplash's effects: the trace, the handoff timeline, the
 * minimum-elapsed signal, the skip gesture and the session flag.
 */

/**
 * idle: built, the rule undrawn, waiting on the frame after the first paint;
 * tracing: the rule draws around the mark as the textures arrive;
 * handing-off: the gate has opened, the rule closes and the mark travels;
 * done: the traveller has landed and the store has been told.
 */
export type IntroPhase = "idle" | "tracing" | "handing-off" | "done";

export type IntroState = {
  phase: IntroPhase;
  /** every parallax texture has arrived */
  loaded: boolean;
  /** one full run of the trace's floor has played */
  minimumElapsed: boolean;
  /** the visitor gestured to skip the intro */
  skipped: boolean;
};

/**
 * start: the frame after the first paint, so the trace may play;
 * loaded / minimum / skip: the gate's three inputs, each in once;
 * landed: the handoff's timeline has completed.
 */
export type IntroEvent = "start" | "loaded" | "minimum" | "skip" | "landed";

export const INTRO_IDLE: IntroState = { phase: "idle", loaded: false, minimumElapsed: false, skipped: false };

/**
 * Whether the splash may hand off to the hero. Pure: the splash never
 * dismisses before textures are in, and — unless skipped — never before one
 * full intro run.
 */
export function introGateOpen({ loaded, minimumElapsed, skipped }: Pick<IntroState, "loaded" | "minimumElapsed" | "skipped">): boolean {
  return loaded && (minimumElapsed || skipped);
}

/** the gate input each event sets */
const INPUTS = { loaded: "loaded", minimum: "minimumElapsed", skip: "skipped" } as const;

/**
 * The next state for `event`, or the same object when the event changes
 * nothing — a repeat input, a skip once the handoff is under way, anything at
 * all once it has landed — so a caller can tell a transition from a no-op by
 * identity. The gate may open from idle as well as tracing: a skip in the
 * two frames before the trace starts still counts, with the textures in.
 */
export function transition(state: IntroState, event: IntroEvent): IntroState {
  switch (state.phase) {
    case "idle":
    case "tracing": {
      if (event === "start") return state.phase === "idle" ? { ...state, phase: "tracing" } : state;
      if (event === "landed") return state;
      const input = INPUTS[event];
      if (state[input]) return state;
      const next = { ...state, [input]: true };
      return introGateOpen(next) ? { ...next, phase: "handing-off" } : next;
    }
    case "handing-off":
      return event === "landed" ? { ...state, phase: "done" } : state;
    case "done":
      return state;
  }
}

/** what the controller reads off the store and writes back to it */
export type IntroStore = Pick<typeof useAppStore, "getState" | "subscribe">;

export type IntroControllerDeps = {
  /** the splash root (the adopted static markup); its ink fades through the handoff */
  root: HTMLElement;
  /** the splash's G mark, which travels to the nav */
  mark: SVGSVGElement | null;
  /** the mark's red rule: traced as the textures arrive, closed by the handoff */
  rule: SVGPathElement | null;
  /** the hero headline as the splash carries it (#107) */
  headline: HTMLElement | null;
  store: IntroStore;
  /** where the skip gestures are listened for */
  skipTarget: EventTarget;
  /** the trace and handoff factories — injectable so tests can scrub their timelines */
  build?: typeof createTrace;
  handoff?: typeof buildHandoff;
};

export type IntroController = {
  /** the machine's state now */
  state(): IntroState;
  /** the trace: its floor timeline is the minimum-elapsed signal */
  trace: Trace;
  /** the handoff timeline, once the gate has opened */
  handoff(): gsap.core.Timeline | null;
  /** the frame after the first paint: the trace plays (a no-op once the gate has opened) */
  start(): void;
  /** the skip: the floor lands on its hold, and the gate opens if the textures are in */
  skip(): void;
  /** stop everything and put the page back where it expects to be; called when the splash unmounts */
  dispose(): void;
};

/**
 * The frame after the next paint. The rule is painted undrawn before it
 * moves: the trace starts there, not at mount, where the scene coming up
 * underneath would eat its first stretch on the clock.
 */
function afterNextPaint(fn: () => void): () => void {
  let frame = requestAnimationFrame(() => {
    frame = requestAnimationFrame(fn);
  });
  return () => cancelAnimationFrame(frame);
}

/**
 * Run the intro over the adopted splash: hold the scene on ink, trace the
 * rule as the store's progress and ready signal arrive, listen for the skip,
 * and once the gate opens write the session flag, close the rule and hand
 * off — the handoff's landing finishes the intro on the store. Every target
 * comes in as an element or off the reveal registry (the nav's mark, the
 * parallax layers); nothing here queries the document.
 */
export function createIntroController({
  root,
  mark,
  rule,
  headline,
  store,
  skipTarget,
  build = createTrace,
  handoff = buildHandoff,
}: IntroControllerDeps): IntroController {
  let state = INTRO_IDLE;
  let timeline: gsap.core.Timeline | null = null;
  // the scene sits on ink until the handoff fades it up
  const parallax = parallaxLayers();
  if (parallax.length) gsap.set(parallax, { opacity: 0 });
  const trace = build(rule);
  const releaseClock = holdClockThroughStalls();

  const openGate = () => {
    // the intro counts as played (or skipped) for the rest of the session
    markIntroPlayed();
    stopListening();
    // a skip lands the trace on its hold so the rule closes from there
    trace.timeline.progress(1);
    timeline = handoff({
      root,
      mark,
      rule,
      headline,
      nav: navMark(),
      parallax,
      onComplete: () => {
        send("landed");
        store.getState().finishIntro();
      },
    });
  };
  const send = (event: IntroEvent) => {
    const next = transition(state, event);
    if (next === state) return;
    const opened = next.phase === "handing-off" && state.phase !== "handing-off";
    state = next;
    if (opened) openGate();
  };

  trace.timeline.eventCallback("onComplete", () => send("minimum"));
  // any gesture is the skip: the first one lands the trace on its hold
  const skip = () => {
    send("skip");
    trace.timeline.progress(1);
  };
  const stopListening = listenForSkip(skipTarget, skip);
  // the textures' share and the ready signal, off the store
  const sync = ({ ready, progress }: ReturnType<IntroStore["getState"]>) => {
    trace.setLoaded(ready ? 1 : progress);
    if (ready) send("loaded");
  };
  sync(store.getState());
  const unsubscribe = store.subscribe(sync);
  const start = () => {
    const before = state;
    send("start");
    if (state !== before) trace.start();
  };
  const cancelStart = afterNextPaint(start);

  return {
    state: () => state,
    trace,
    handoff: () => timeline,
    start,
    skip,
    dispose() {
      cancelStart();
      unsubscribe();
      stopListening();
      releaseClock();
      trace.kill();
      // an interrupted handoff is jumped to its end so the nav's mark is
      // shown and the parallax is up, where the page expects them — its
      // callbacks aside: the landing is the timeline's own completion, and a
      // splash brought down from outside (the preference flipped to reduced
      // motion, #132) has its store set already and plays no reveal after
      if (timeline) {
        if (timeline.progress() < 1) timeline.progress(1, true);
        timeline.kill();
      }
      timeline = null;
      if (parallax.length) gsap.set(parallax, { clearProps: "opacity" });
    },
  };
}
