import { useEffect, useRef, useState } from "react";

import GMark from "@/components/GMark";
import { gMarkAspect } from "@/components/gMarkGeometry";
import { gsap } from "@/lib/gsap";
import { introGateOpen } from "@/intro/gate";
import { buildHandoff } from "@/intro/handoff";
import { listenForSkip, markIntroPlayed } from "@/intro/introPolicy";
import { parallaxLayers } from "@/intro/restingFade";
import { createTrace, type Trace } from "@/intro/trace";

/** the mark's share of the shorter viewport side */
export const SPLASH_MARK_FRACTION = 0.72;

/** as tall as the viewport allows, or as wide, whichever binds first */
export const SPLASH_MARK_SIZE = `min(${SPLASH_MARK_FRACTION * 100}svh, calc(${SPLASH_MARK_FRACTION * 100}vw / ${gMarkAspect(true)}))`;

/** the nav's G mark, the traveller's destination */
export const NAV_MARK = "[data-nav-mark] [data-g-mark]";

export type IntroSplashProps = {
  /** every parallax texture has arrived */
  ready: boolean;
  /** the textures' share so far, 0–1; drives the rule ahead of the time floor */
  progress?: number;
  /** the visitor gestured past the intro; the gate no longer waits for the full run */
  skipped?: boolean;
  /** the handoff has landed; unmount the splash */
  onDone: () => void;
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
 * while the scene fades up underneath.
 */
export default function IntroSplash({
  ready,
  progress = 0,
  skipped = false,
  onDone,
  build = createTrace,
  handoff = buildHandoff,
}: IntroSplashProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const traceRef = useRef<Trace | null>(null);
  const handoffRef = useRef<gsap.core.Timeline | null>(null);
  const [minimumElapsed, setMinimumElapsed] = useState(false);
  const [gestured, setGestured] = useState(false);
  const stopListeningRef = useRef<() => void>(() => {});
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    // the scene sits on ink until the handoff fades it up
    const parallax = parallaxLayers();
    if (parallax.length) gsap.set(parallax, { opacity: 0 });

    const trace = build(root.querySelector<SVGPathElement>("[data-g-mark-rule]"));
    trace.timeline.eventCallback("onComplete", () => setMinimumElapsed(true));
    trace.timeline.play();
    traceRef.current = trace;
    return () => {
      trace.timeline.kill();
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
      nav: document.querySelector<SVGSVGElement>(NAV_MARK),
      parallax: parallaxLayers(),
      onComplete: () => onDoneRef.current(),
    });
    // handoff is configuration fixed for the life of the splash
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, minimumElapsed, skipped, gestured]);

  return (
    <div
      ref={rootRef}
      data-intro-splash=""
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink"
      aria-hidden
    >
      <GMark size={SPLASH_MARK_SIZE} ruled decorative className="text-cream" />
    </div>
  );
}
