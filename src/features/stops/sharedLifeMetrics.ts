import { G_MARK_CORNER as CORNER, G_MARK_H as H, G_MARK_W as W } from "@/marks/gMarkGeometry";

/** The shared life's measures (SharedLife.tsx), in the logo's units. */

/** the lines of the program, a house church's dozen */
export const LIFE_ROWS = 12;

/** a slot: the G mark's box, at this scale of the mark — the table's seats' size */
const SLOT = 0.45;
export const SLOT_W = Math.round(W * SLOT);
export const SLOT_H = Math.round(H * SLOT);
export const SLOT_CORNER = Math.round(CORNER * SLOT);
/** the gap between rows, and between a slot and its line */
export const LIFE_GAP = Math.round(H * 0.2);
/** the lines' longest run, in the mark's width */
export const LINE_W = Math.round(W * 2.2);

/** a slot grows this much leaving its row: a line item is smaller than a person */
export const HUDDLE_SCALE = 1.6;

/** the drawing's extent in one column */
export const LIFE_VIEW_W = SLOT_W + LIFE_GAP + LINE_W;
export const LIFE_VIEW_H = LIFE_ROWS * SLOT_H + (LIFE_ROWS - 1) * LIFE_GAP;
/** the gap between two columns, in the mark's width */
export const COLUMN_GAP = Math.round(W * 0.9);
/** the drawing's extent in two columns: six rows down each, side by side */
export const LIFE_VIEW_W_2 = 2 * LIFE_VIEW_W + COLUMN_GAP;
export const LIFE_VIEW_H_2 = (LIFE_ROWS / 2) * SLOT_H + (LIFE_ROWS / 2 - 1) * LIFE_GAP;
