import { useCallback, useState } from "react";

/** the way the traveller is walking, from the last step to this one */
export type Direction = "next" | "back";

/** where the traveller stands on the way in, and which way it last walked to get there (none before it has) */
export type WayStand = { step: number; dir?: Direction };

/** the stand after a walk to `step`: the same stand if it is already there, else the step with the way it went */
export function walkTo(from: WayStand, step: number): WayStand {
  if (step === from.step) return from;
  return { step, dir: step > from.step ? "next" : "back" };
}

/**
 * The step of the way in the reader stands on, kept by the stop that owns
 * it (VisitStop): the arrows ask for a step through `onStep`, and the
 * direction of the walk is derived from the change, so the way in can slide
 * the new step in from the side the reader is walking toward without
 * keeping a step of its own.
 */
export function useWayStep(initial = 0): [WayStand, (step: number) => void] {
  const [stand, setStand] = useState<WayStand>({ step: initial });
  const onStep = useCallback((step: number) => setStand((from) => walkTo(from, step)), []);
  return [stand, onStep];
}
