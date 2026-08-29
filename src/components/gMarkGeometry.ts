/** The G mark's box, in the logo's own units, and the rule traced around it. */

export const G_MARK_W = 1855;
export const G_MARK_H = 1976;
export const G_MARK_CORNER = 420;

/** the rule: its distance from the box, its weight, and its corner radius (concentric with the box's) */
export const RULE_GAP = 170;
export const RULE_WEIGHT = 56;
export const RULE_CORNER = G_MARK_CORNER + RULE_GAP;
/** the rule's outer edge, so the viewBox can hold it */
export const RULE_PAD = RULE_GAP + RULE_WEIGHT / 2;

/** width over height of the rendered svg, with or without the rule */
export function gMarkAspect(ruled: boolean): number {
  const pad = ruled ? RULE_PAD : 0;
  return (G_MARK_W + 2 * pad) / (G_MARK_H + 2 * pad);
}
