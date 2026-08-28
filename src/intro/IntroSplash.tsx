import { useEffect, useRef, useState } from "react";

import Lockup from "@/components/Lockup";
import { gsap } from "@/lib/gsap";
import { introBeats } from "@/intro/beats";
import { introGateOpen } from "@/intro/gate";
import { buildHandoff } from "@/intro/handoff";
import { listenForSkip, markIntroPlayed } from "@/intro/introPolicy";
import { introTargets } from "@/intro/targets";
import { buildIntroTimeline, type IntroBeat } from "@/intro/timeline";

/** Title-card size: the script line stands ≥ 28px on any phone (28 / SCRIPT_EM ≈ 61px). */
export const SPLASH_LOCKUP_SIZE = "clamp(62px,12vw,160px)";

export type IntroSplashProps = {
  /** beats beyond the wordmark wipe, each landing in its own label */
  beats?: IntroBeat[];
  /** every parallax texture has arrived */
  ready: boolean;
  /** the visitor gestured past the intro; the gate no longer waits for the full run */
  skipped?: boolean;
  /** the handoff has landed; unmount the splash */
  onDone: () => void;
  /** timeline factory — injectable so tests can scrub the sequence */
  build?: typeof buildIntroTimeline;
  /** handoff factory — injectable so tests can scrub the Flip */
  handoff?: typeof buildHandoff;
};

/**
 * Full-screen intro on ink that doubles as the loading screen: the lockup plays
 * its beats, then waits until the parallax is ready, and hands the lockup off
 * to the hero with a layout animation while the scene fades up underneath.
 */
export default function IntroSplash({
  beats = introBeats,
  ready,
  skipped = false,
  onDone,
  build = buildIntroTimeline,
  handoff = buildHandoff,
}: IntroSplashProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const introRef = useRef<gsap.core.Timeline | null>(null);
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
    const parallax = document.querySelector<HTMLElement>("[data-parallax]");
    if (parallax) gsap.set(parallax, { opacity: 0 });

    const tl = build(introTargets(root), beats);
    tl.eventCallback("onComplete", () => setMinimumElapsed(true));
    tl.play();
    introRef.current = tl;
    return () => {
      tl.kill();
      introRef.current = null;
      // a finished handoff has already cleared the hero; an interrupted one jumps to its end
      handoffRef.current?.revert();
      handoffRef.current = null;
      if (parallax) gsap.set(parallax, { clearProps: "opacity" });
    };
    // beats/build are configuration fixed for the life of the splash
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // any gesture is the skip: the first one lands the intro on its resting state
  useEffect(() => {
    const stop = listenForSkip(window, () => {
      introRef.current?.progress(1);
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
    // a skip lands the intro on its resting state so the lockup travels whole
    introRef.current?.progress(1);
    handoffRef.current = handoff({
      root,
      hero: document.querySelector<HTMLElement>("[data-hero-lockup]"),
      parallax: document.querySelector<HTMLElement>("[data-parallax]"),
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
      <Lockup size={SPLASH_LOCKUP_SIZE} sealVariant="live" script />
    </div>
  );
}
