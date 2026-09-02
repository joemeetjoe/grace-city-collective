import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { gsap } from "@/lib/gsap";
import { useAppStore } from "@/state/appStore";
import { introGateOpen } from "./gate";
import { buildHandoff, navMark } from "./handoff";
import { listenForSkip, markIntroPlayed } from "./introPolicy";
import { parallaxLayers } from "./restingFade";
import { SPLASH_HEADLINE_ATTR } from "./staticSplash";
import { adoptStaticSplash } from "./staticSplashDom";
import { createTrace, holdClockThroughStalls, type Trace } from "./trace";


export type IntroSplashProps = {
  /** the visitor gestured past the intro; the gate no longer waits for the full run */
  skipped?: boolean;
  /** trace factory — injectable so tests can scrub the floor */
  build?: typeof createTrace;
  /** handoff factory — injectable so tests can scrub the travel */
  handoff?: typeof buildHandoff;
};

/**
 * Full-screen intro on ink that doubles as the loading screen: the G mark
 * fills the viewport and its red rule draws itself around the box as the
 * textures arrive. Once they are in (and the rule has had its minimum run,
 * or the visitor skipped), the rule closes and the mark travels into the nav
 * while the scene fades up underneath. The textures' progress and the ready
 * signal come off the store (the engine writes them); the handoff's landing
 * finishes the intro there, which unmounts the splash.
 *
 * The splash stands in index.html as static markup (staticSplash.ts) from
 * the page's first paint, the hero headline included, set in the hero's box
 * by the inline head style (#107). This component renders nothing of its
 * own: it adopts that markup the moment it is committed and animates it —
 * the headline is the page's LCP element, and an h1 re-created at mount
 * would be a new, later candidate. At the handoff the hero's own h1, hidden
 * while the intro is pending, takes over without a pixel moving.
 */
export default function IntroSplash({
  skipped = false,
  build = createTrace,
  handoff = buildHandoff,
}: IntroSplashProps) {
  const ready = useAppStore((s) => s.ready);
  const progress = useAppStore((s) => s.progress);
  const finishIntro = useAppStore((s) => s.finishIntro);
  const rootRef = useRef<HTMLElement | null>(null);
  const traceRef = useRef<Trace | null>(null);
  const handoffRef = useRef<gsap.core.Timeline | null>(null);
  const [minimumElapsed, setMinimumElapsed] = useState(false);
  const [gestured, setGestured] = useState(false);
  const stopListeningRef = useRef<() => void>(() => {});

  // before paint: the static splash is the splash, taken over as it stands;
  // it goes when this unmounts, in the same commit that shows the hero's h1
  useLayoutEffect(() => {
    const root = adoptStaticSplash();
    rootRef.current = root;
    return () => {
      root.remove();
      rootRef.current = null;
    };
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    // the scene sits on ink until the handoff fades it up
    const parallax = parallaxLayers();
    if (parallax.length) gsap.set(parallax, { opacity: 0 });

    const trace = build(root.querySelector<SVGPathElement>("[data-g-mark-rule]"));
    trace.timeline.eventCallback("onComplete", () => setMinimumElapsed(true));
    traceRef.current = trace;
    const releaseClock = holdClockThroughStalls();
    // the rule is painted undrawn before it moves: the trace starts on the
    // frame after the splash's first paint, not on mount, where the scene
    // coming up underneath would eat its first stretch on the clock
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => trace.start());
    });
    return () => {
      cancelAnimationFrame(frame);
      releaseClock();
      trace.kill();
      traceRef.current = null;
      // an interrupted handoff is jumped to its end so the nav's mark is
      // shown and the parallax is up, where the page expects them
      const handoff = handoffRef.current;
      if (handoff) {
        if (handoff.progress() < 1) handoff.progress(1);
        handoff.kill();
      }
      handoffRef.current = null;
      if (parallax.length) gsap.set(parallax, { clearProps: "opacity" });
    };
    // build is configuration fixed for the life of the splash
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    traceRef.current?.setLoaded(ready ? 1 : progress);
  }, [progress, ready]);

  // any gesture is the skip: the first one lands the trace on its hold
  useEffect(() => {
    const stop = listenForSkip(window, () => {
      traceRef.current?.timeline.progress(1);
      setGestured(true);
    });
    stopListeningRef.current = stop;
    return stop;
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    const gate = { loaded: ready, minimumElapsed, skipped: skipped || gestured };
    if (!root || handoffRef.current || !introGateOpen(gate)) return;
    // the intro counts as played (or skipped) for the rest of the session
    markIntroPlayed();
    stopListeningRef.current();
    // a skip lands the trace on its hold so the rule closes from there
    traceRef.current?.timeline.progress(1);
    handoffRef.current = handoff({
      root,
      mark: root.querySelector<SVGSVGElement>("[data-g-mark]"),
      rule: root.querySelector<SVGPathElement>("[data-g-mark-rule]"),
      headline: root.querySelector<HTMLElement>(`[${SPLASH_HEADLINE_ATTR}]`),
      nav: navMark(),
      parallax: parallaxLayers(),
      onComplete: finishIntro,
    });
    // handoff is configuration fixed for the life of the splash
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, minimumElapsed, skipped, gestured, finishIntro]);

  // the splash is the adopted static markup; nothing to render here
  return null;
}
