import { snapTo, type SnapLayout } from "./snap";

/** a wheel notch or swipe: forward is down the page */
export type PageDirection = 1 | -1;

/** slack on the scene's end, so a rounded scroll position still counts as inside */
const EDGE = 1;

/**
 * Whether a scroll position is in the paged region: the scene, up to and
 * including the last section's top. Past it the long-form scrolls freely.
 */
export function inScene(scrollY: number, { tops, end }: SnapLayout): boolean {
  return tops.length > 0 && scrollY <= end + EDGE;
}

/**
 * Where one gesture takes the page: the top of the section after (or before)
 * the one the position sits on. Null when there is no such section — at the
 * hero going back, or at the last section going on, where the scene lets go
 * and the long-form takes the scroll — and outside the scene altogether.
 */
export function pageTarget(scrollY: number, direction: PageDirection, layout: SnapLayout): number | null {
  if (!inScene(scrollY, layout)) return null;
  const here = layout.tops.indexOf(snapTo(Math.min(scrollY, layout.end), layout));
  const next = here + direction;
  if (here < 0 || next < 0 || next >= layout.tops.length) return null;
  return layout.tops[next];
}
