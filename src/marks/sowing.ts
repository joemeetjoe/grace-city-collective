import { SOW_STEP_MS, SOW_TRAVEL_MS } from "@/theme/motion";

/**
 * The sown field's hand-off (SowingMark): which tile a grain comes down
 * from, and when. A row's grains travel down from the row above
 * (SOW_TRAVEL_MS), the row fills as they land (SOW_FILL_MS), and after a beat
 * (SOW_HOLD_MS) it hands its own grains on; one step of the sequence is the
 * three together (SOW_STEP_MS; theme/motion.ts).
 */

/** the tile a grain comes down from: the nearest of the two above, the left one for the row's last */
export function parent(row: number, col: number): { row: number; col: number } {
  return { row: row - 1, col: Math.min(col, row - 1) };
}

/** when a row's grains set out from the row above */
export function departs(row: number): number {
  return (row - 1) * SOW_STEP_MS;
}

/** when a row's grains land, and its fill with them */
export function arrives(row: number): number {
  return departs(row) + SOW_TRAVEL_MS;
}
