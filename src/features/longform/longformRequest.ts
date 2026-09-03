/**
 * The page's one request for the long-form chunk (#111), shared by the two
 * things that make it — the in-view trigger in LongformGate.tsx, and a nav
 * jump to a long-form section (app/jump.ts) — and the one answer: the chunk
 * has mounted, its sections are their full height, a jump can land. Module
 * state, not React state, so the jump handler needs no tree to reach it.
 */

type Listener = () => void;

/**
 * How far ahead of the reader the chunk is asked for, as the observer's
 * rootMargin: two viewports below the fold, nothing above (the reader comes
 * down the page). On a wheel that is several seconds of scroll; on a phone's
 * flick, still comfortably before the first section's top is on screen.
 */
export const LONGFORM_MARGIN = "0px 0px 200% 0px";

let requested = false;
let mounted = false;
const listeners = new Set<Listener>();
let settle: () => void = () => {};
const arrival = new Promise<void>((resolve) => {
  settle = resolve;
});

/** whether anything has asked for the chunk yet */
export function isLongformRequested(): boolean {
  return requested;
}

/** whether the chunk's words are in their sections */
export function isLongformMounted(): boolean {
  return mounted;
}

/** hear each change — the first request, then the mount; returns the function that stops listening */
export function subscribeLongform(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Ask for the chunk. The first call tells the gate to import it; every call
 * returns the promise that resolves once the words have mounted — at once,
 * after that.
 */
export function requestLongform(): Promise<void> {
  if (!requested) {
    requested = true;
    for (const listener of listeners) listener();
  }
  return arrival;
}

/** the gate's word that the chunk has committed into its sections */
export function markLongformMounted(): void {
  if (mounted) return;
  mounted = true;
  for (const listener of listeners) listener();
  settle();
}
