/** The G mark's box, in the logo's own units, and the rule traced around it. */

export const G_MARK_W = 1855;
export const G_MARK_H = 1976;
export const G_MARK_CORNER = 420;

/** the slab G knocked out of the box, traced from the logo on gracecitycollective.com */
export const G_MARK_LETTER =
  "M134 609A520 520 0 0 1 654 89H1156A520 520 0 0 1 1676 609V639H1329V635A250 250 0 0 0 1079 385H734A250 250 0 0 0 484 635V1338A250 250 0 0 0 734 1588H1079A250 250 0 0 0 1329 1338V1182H889V924H1676V1364A520 520 0 0 1 1156 1884H654A520 520 0 0 1 134 1364Z";

/**
 * The box with the top-left and bottom-right corners rounded by `r`, inset
 * by `i` from the logo's edges (negative grows it), in the logo's units.
 */
export function gMarkBox(i: number, r: number): string {
  const x0 = i;
  const y0 = i;
  const x1 = G_MARK_W - i;
  const y1 = G_MARK_H - i;
  return `M${x0 + r} ${y0}H${x1}V${y1 - r}A${r} ${r} 0 0 1 ${x1 - r} ${y1}H${x0}V${y0 + r}A${r} ${r} 0 0 1 ${x0 + r} ${y0}Z`;
}

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
