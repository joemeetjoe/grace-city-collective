import { useEffect, useRef } from "react";

import Lockup from "@/components/Lockup";
import { gsap } from "@/lib/gsap";
import { introBeats } from "@/intro/beats";
import { introTargets } from "@/intro/targets";
import { buildIntroTimeline, type IntroBeat } from "@/intro/timeline";

/** Title-card size: the script line stands ≥ 28px on any phone (28 / SCRIPT_EM ≈ 61px). */
export const SPLASH_LOCKUP_SIZE = "clamp(62px,12vw,160px)";

export const SPLASH_FADE_SECONDS = 0.5;

export type IntroSplashProps = {
  /** beats beyond the wordmark wipe, each landing in its own label */
  beats?: IntroBeat[];
  /** the splash has faded; unmount it */
  onDone: () => void;
  /** timeline factory — injectable so tests can scrub the sequence */
  build?: typeof buildIntroTimeline;
};

/**
 * Full-screen intro on ink: the lockup plays its beats, then the splash fades
 * and the hero underneath is shown as normal.
 */
export default function IntroSplash({ beats = introBeats, onDone, build = buildIntroTimeline }: IntroSplashProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const tl = build(introTargets(root), beats);
    tl.addLabel("exit");
    tl.to(root, { opacity: 0, duration: SPLASH_FADE_SECONDS, ease: "power2.inOut" }, "exit");
    tl.eventCallback("onComplete", () => onDoneRef.current());
    tl.play();
    return () => {
      tl.kill();
      gsap.set(root, { clearProps: "opacity" });
    };
    // beats/build are configuration fixed for the life of the splash
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={rootRef}
      data-intro-splash=""
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink"
      aria-hidden
    >
      <Lockup size={SPLASH_LOCKUP_SIZE} />
    </div>
  );
}
