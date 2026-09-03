import { G_MARK_CORNER as CORNER, G_MARK_H as H, G_MARK_W as W } from "@/marks/gMarkGeometry";

/** The house table's measures (HouseTable.tsx), in the logo's units. */

/** seats down each long side of the table; with the head and the foot, a house church's dozen */
export const SIDE_SEATS = 5;
export const SEATS = SIDE_SEATS * 2 + 2;

/** a seat: the G mark's box, at this scale of the mark */
const SEAT = 0.45;
export const SEAT_W = Math.round(W * SEAT);
export const SEAT_H = Math.round(H * SEAT);
export const SEAT_CORNER = Math.round(CORNER * SEAT);
/** the gap between a seat and the table, and between neighbours down a side */
export const TABLE_GAP = Math.round(H * 0.2);
/** the table: the mark's box drawn long, with the mark's own corners, sized to seat a side */
export const TABLE_W = W;
export const TABLE_H = SIDE_SEATS * SEAT_H + (SIDE_SEATS + 1) * TABLE_GAP;

/** the drawing's extent */
export const TABLE_VIEW_W = TABLE_W + 2 * (TABLE_GAP + SEAT_W);
export const TABLE_VIEW_H = TABLE_H + 2 * (TABLE_GAP + SEAT_H);
