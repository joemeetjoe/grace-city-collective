import { useCallback, useEffect, useRef, type KeyboardEvent, type RefObject } from "react";

import { stampTween } from "@/components/sealStamp";
import { REDUCED_MOTION_QUERY } from "@/intro/introPolicy";

export const STAMP_REPLAY_LABEL = "Replay the seal stamp";

export type StampReplayHandlers = {
  onClick: () => void;
  onKeyDown: (e: KeyboardEvent) => void;
};

/**
 * The easter egg: replay the press on a resting seal. Click, Enter or Space
 * runs `stampTween` once; triggers that land mid-beat are ignored, reduced
 * motion turns the whole thing into a no-op, and an unmount kills the beat.
 */
export function useStampReplay(sealRef: RefObject<SVGSVGElement | null>): StampReplayHandlers {
  const beatRef = useRef<ReturnType<typeof stampTween> | null>(null);

  useEffect(
    () => () => {
      beatRef.current?.kill();
      beatRef.current = null;
    },
    [],
  );

  const replay = useCallback(() => {
    const seal = sealRef.current;
    if (!seal) return;
    // still pressing: one beat at a time (progress, not isActive — a timeline
    // created this same frame has not rendered yet and reads as inactive)
    if (beatRef.current && beatRef.current.progress() < 1) return;
    if (window.matchMedia?.(REDUCED_MOTION_QUERY).matches) return;
    beatRef.current = stampTween(seal);
  }, [sealRef]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      replay();
    },
    [replay],
  );

  return { onClick: replay, onKeyDown };
}
