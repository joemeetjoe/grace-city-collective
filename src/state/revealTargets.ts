/**
 * The elements the intro animates once the splash has handed off — the nav's
 * section links and calls to action, the dot rail's dots, the frosted glass
 * behind the links and the dots, and the nav's own G mark the traveller
 * lands on — registered by the components that render them, so the intro
 * (features/intro/navReveal.ts, handoff.ts) never finds them by selector.
 *
 * This is a registry of DOM elements, not store state: nothing here is
 * reactive, and no component reads it. It lives beside the store as the one
 * module the nav and the intro (sibling features) may both import, which is
 * the exception to "refs never go in the store" — they are not in it.
 */

export type RevealKind = "link" | "action" | "dot" | "glass" | "mark";

const targets: Record<RevealKind, Set<Element>> = {
  link: new Set(),
  action: new Set(),
  dot: new Set(),
  glass: new Set(),
  mark: new Set(),
};

/** `el` is one of the intro's `kind` targets until the returned function is called */
export function registerRevealTarget(kind: RevealKind, el: Element): () => void {
  targets[kind].add(el);
  return () => {
    targets[kind].delete(el);
  };
}

/** every registered target of `kind`, in document order */
export function revealTargets(kind: RevealKind): Element[] {
  return Array.from(targets[kind]).sort((a, b) =>
    a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
  );
}

type RevealRef = (el: Element | null) => (() => void) | undefined;

const refs = new Map<RevealKind, RevealRef>();

/**
 * A ref callback that registers the element it is given as a `kind` target
 * and hands React the unregister as its cleanup (React 19 ref cleanups).
 * The same function for every call with the same kind, so a re-render does
 * not detach and re-attach the ref.
 */
export function revealRef(kind: RevealKind): RevealRef {
  let ref = refs.get(kind);
  if (!ref) {
    ref = (el) => (el ? registerRevealTarget(kind, el) : undefined);
    refs.set(kind, ref);
  }
  return ref;
}
