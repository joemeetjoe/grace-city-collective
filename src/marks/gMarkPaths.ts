/**
 * The G mark's artwork as drawn (GMark.tsx), settled once from the box
 * geometry in gMarkGeometry.ts — which stays the shared box maths the
 * calendar, the table and the static splash build on. DOM-free.
 */
import {
  G_MARK_CORNER,
  G_MARK_H,
  G_MARK_LETTER,
  G_MARK_W,
  RULE_CORNER,
  RULE_GAP,
  RULE_PAD,
  gMarkBox,
} from "./gMarkGeometry";

/** the mark: the box with the slab G knocked out of it (evenodd), one path */
export const G_MARK_D = `${gMarkBox(0, G_MARK_CORNER)} ${G_MARK_LETTER}`;

/** the finer rule traced around the outside of the box, concentric with it */
export const G_MARK_RULE_D = gMarkBox(-RULE_GAP, RULE_CORNER);

/** the mark's own user space */
export const G_MARK_VIEWBOX = `0 0 ${G_MARK_W} ${G_MARK_H}`;

/** the user space grown to hold the rule */
export const G_MARK_RULED_VIEWBOX = `${-RULE_PAD} ${-RULE_PAD} ${G_MARK_W + 2 * RULE_PAD} ${G_MARK_H + 2 * RULE_PAD}`;
