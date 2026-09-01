/**
 * The sown field's hand-off (SowingMark): which tile a grain comes down
 * from, and when. A row's grains travel down from the row above (TRAVEL),
 * the row fills as they land (FILL), and after a beat (HOLD) it hands its
 * own grains on; one step of the sequence is the three together.
 */

export const TRAVEL_MS = 400;
export const FILL_MS = 300;
export const HOLD_MS = 100;
export const STEP_MS = TRAVEL_MS + FILL_MS + HOLD_MS;
/** how long a row's grains take to leave once handed on */
export const LEAVE_MS = 200;

/** the tile a grain comes down from: the nearest of the two above, the left one for the row's last */
export function parent(row: number, col: number): { row: number; col: number } {
  return { row: row - 1, col: Math.min(col, row - 1) };
}

/** when a row's grains set out from the row above */
export function departs(row: number): number {
  return (row - 1) * STEP_MS;
}

/** when a row's grains land, and its fill with them */
export function arrives(row: number): number {
  return departs(row) + TRAVEL_MS;
}
