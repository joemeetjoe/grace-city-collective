import { G_MARK_H as H, G_MARK_W as W } from "@/marks/gMarkGeometry";

/** The gathering calendar's measures (GatheringCalendar.tsx), in the logo's units. */

/** a month set on its side: four weeks across, the seven days down, Sundays on top */
export const WEEKS = 4;
export const DAYS = 7;

/** the gap between neighbouring days */
export const CALENDAR_GAP = Math.round(H * 0.22);
/** the week numerals' row above the month */
export const CALENDAR_HEAD = Math.round(H * 0.8);
/** the band between the Sundays and the week, with the rule through it */
export const CALENDAR_BAND = Math.round(H * 0.7);
/** the gutter on the left for the S at each end of the week */
export const CALENDAR_GUTTER = Math.round(H * 0.9);

/** the month's extent */
export const CALENDAR_VIEW_W = CALENDAR_GUTTER + WEEKS * W + (WEEKS - 1) * CALENDAR_GAP;
export const CALENDAR_VIEW_H = CALENDAR_HEAD + DAYS * H + (DAYS - 1) * CALENDAR_GAP + CALENDAR_BAND;
/**
 * the month across: the head row over the days holds the S at each end of
 * the week, the gutter at the left the week numerals, and the band with the
 * rule stands between the Sundays' column and the six weekdays
 */
export const CALENDAR_VIEW_W_ACROSS = CALENDAR_GUTTER + DAYS * W + (DAYS - 1) * CALENDAR_GAP + CALENDAR_BAND;
export const CALENDAR_VIEW_H_ACROSS = CALENDAR_GUTTER + WEEKS * H + (WEEKS - 1) * CALENDAR_GAP;
