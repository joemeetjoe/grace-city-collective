/**
 * Where the scene settles once the wheel stops. The scene is six one-viewport
 * sections; each section top is a waypoint. Past the scene's end the long-form
 * scrolls freely, so there the input comes back untouched.
 */
export type SnapLayout = {
  /** document-relative tops of the scene sections, ascending */
  tops: number[];
  /** the scroll position where the scene ends: its bottom meets the viewport's */
  end: number;
};

/** the nearest waypoint to a scroll position inside the scene; ties go forward */
export function snapTo(scrollY: number, { tops, end }: SnapLayout): number {
  if (!tops.length || scrollY > end) return scrollY;
  let best = tops[0];
  for (const top of tops) {
    if (Math.abs(top - scrollY) <= Math.abs(best - scrollY)) best = top;
  }
  return best;
}

/**
 * The same, in a ScrollTrigger's progress space (0..1 over `start`..`layout.end`),
 * which is what its `snap.snapTo` callback trades in.
 */
export function snapProgress(progress: number, start: number, layout: SnapLayout): number {
  const span = layout.end - start;
  if (span <= 0) return progress;
  return (snapTo(start + progress * span, layout) - start) / span;
}

/** an element's document-relative top from layout alone: transforms (the smoother's) do not count */
export function documentTop(el: HTMLElement): number {
  let top = 0;
  let node: Element | null = el;
  while (node instanceof HTMLElement) {
    top += node.offsetTop;
    node = node.offsetParent;
  }
  return top;
}
