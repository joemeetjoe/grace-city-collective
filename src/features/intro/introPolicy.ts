import { REDUCED_MOTION_QUERY } from "@/device/reducedMotion";
import { INTRO_PLAYED_KEY } from "./introKeys";

export { INTRO_PLAYED_KEY, REDUCED_MOTION_QUERY };

export type IntroPolicyInputs = {
  /** the session flag is set: the intro already played or was skipped */
  playedThisSession: boolean;
  /** the visitor prefers reduced motion */
  reducedMotion: boolean;
};

/**
 * Whether the splash mounts at all. Pure: once per session, and never for
 * visitors who asked for reduced motion — the hero renders at rest instead.
 */
export function shouldPlayIntro({ playedThisSession, reducedMotion }: IntroPolicyInputs): boolean {
  return !playedThisSession && !reducedMotion;
}

function sessionStorageOrNull(): Storage | undefined {
  try {
    return window.sessionStorage;
  } catch {
    // private mode / blocked storage: the accessor itself can throw
    return undefined;
  }
}

/** the session flag, tolerant of storage that is missing or throws — a throw reads as "not played" */
export function readIntroPlayed(storage: Storage | undefined = sessionStorageOrNull()): boolean {
  try {
    return storage?.getItem(INTRO_PLAYED_KEY) != null;
  } catch {
    return false;
  }
}

/** set the session flag; a storage that refuses the write is ignored */
export function markIntroPlayed(storage: Storage | undefined = sessionStorageOrNull()): void {
  try {
    storage?.setItem(INTRO_PLAYED_KEY, "1");
  } catch {
    // nothing to do: the intro simply plays again next load
  }
}

/** gather the policy inputs from the browser (both seams injectable for tests) */
export function readPolicyInputs(
  storage: Storage | undefined = sessionStorageOrNull(),
  matchMedia: typeof window.matchMedia | undefined = window.matchMedia,
): IntroPolicyInputs {
  return {
    playedThisSession: readIntroPlayed(storage),
    reducedMotion: matchMedia?.(REDUCED_MOTION_QUERY).matches ?? false,
  };
}

/** the gestures that skip the splash: there is no button, the gesture is the skip */
export const SKIP_GESTURES = ["pointerdown", "keydown", "wheel", "touchmove"] as const;

/**
 * Fire `onSkip` once on the first skip gesture. Returns the teardown; calling
 * it (or the first gesture) removes every listener.
 */
export function listenForSkip(target: EventTarget, onSkip: () => void): () => void {
  const stop = () => {
    for (const type of SKIP_GESTURES) target.removeEventListener(type, fire);
  };
  const fire = () => {
    stop();
    onSkip();
  };
  for (const type of SKIP_GESTURES) target.addEventListener(type, fire, { passive: true });
  return stop;
}
