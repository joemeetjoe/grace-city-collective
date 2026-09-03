import type { CSSProperties } from "react";

import { TILE_STAGGER_MS } from "@/theme/motion";

/**
 * The tile engine's geometry (#125): the pure parts the four ornaments —
 * the house table, the shared life, the gathering calendar and the way
 * in — share. A tile is one box of the G mark drawn in a hairline; it
 * waits out of place and small, prints in at its turn in a stagger, and
 * poses about its own centre when the reader is over the drawing. The
 * numbers and strings here are what the tiles' inline styles and
 * transition utilities are made of; Tile.tsx turns them into markup.
 * DOM-free: every function here is a pure map from its arguments.
 */

/** how far out from its place a waiting tile sits, in its own heights, and how small */
export const TILE_ENTER_OUT = 0.6;
export const TILE_ENTER_SCALE = 0.55;

/** the properties a tile's transition may carry, in the order the utility lists them */
export type TransitionProp =
  | "fill"
  | "fill-opacity"
  | "stroke"
  | "stroke-opacity"
  | "opacity"
  | "transform";

/** a colour answers in half a second; a place, in nine tenths on the site's ease */
const TIMING: Record<TransitionProp, string> = {
  fill: ".5s_ease",
  "fill-opacity": ".5s_ease",
  stroke: ".5s_ease",
  "stroke-opacity": ".5s_ease",
  opacity: ".9s_var(--ease-site)",
  transform: ".9s_var(--ease-site)",
};

/** the motion-safe arbitrary transition utility over these properties, in this order */
export function tileTransition(props: readonly TransitionProp[]): string {
  return `motion-safe:[transition:${props.map((p) => `${p}_${TIMING[p]}`).join(",")}]`;
}

/** the whole set: a tile's fill and stroke, and its place */
export const TILE_TRANSITION = tileTransition([
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-opacity",
  "opacity",
  "transform",
]);

/** the wait before the piece at this place in the order moves, in ms */
export function staggerMs(order: number, step = TILE_STAGGER_MS): number {
  return order * step;
}

/** the same, as CSS reads it */
export function stagger(order: number, step = TILE_STAGGER_MS): string {
  return `${staggerMs(order, step)}ms`;
}

/** a transform about the tile's own centre: moved by (dx, dy) in the drawing's units, then scaled */
export function pose(dx: number, dy: number, scale = 1): string {
  return `translate(${dx}px, ${dy}px) scale(${scale})`;
}

/** a tile in its place, unmoved */
export const AT_REST = pose(0, 0, 1);

/** a waiting tile's pose: out along (dx, dy) by TILE_ENTER_OUT of its height, and small */
export function enterPose(dx: number, dy: number, height: number): string {
  const out = TILE_ENTER_OUT * height;
  return pose(out * dx, out * dy, TILE_ENTER_SCALE);
}

/** how far up a waiting piece sits over its place, in the drawing's units */
export function enterLift(height: number): number {
  return -TILE_ENTER_OUT * height;
}

/** a tile's pose group's inline style: the pose about its own box, its turn in the stagger, and faded while it waits */
export function tileStyle(transform: string, delay: string, shown: boolean): CSSProperties {
  return {
    transform,
    transformOrigin: "center",
    transformBox: "fill-box",
    transitionDelay: delay,
    opacity: shown ? 1 : 0,
  };
}

/** the inline style of a piece that only fades in at its turn */
export function fadeStyle(shown: boolean, delay: string): CSSProperties {
  return { opacity: shown ? 1 : 0, transitionDelay: delay };
}
