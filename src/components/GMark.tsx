import type { CSSProperties } from "react";

import {
  G_MARK_CORNER as CORNER,
  G_MARK_H as H,
  G_MARK_W as W,
  RULE_CORNER,
  RULE_GAP,
  RULE_PAD as PAD,
  RULE_WEIGHT,
  gMarkAspect,
} from "@/components/gMarkGeometry";
import { site } from "@/content/site";

export type GMarkProps = {
  /** rendered height: px as a number, or any CSS length (e.g. "0.63em") */
  size?: number | string;
  title?: string;
  /** a second, finer rule traced around the outside of the box, in the seal's red */
  ruled?: boolean;
  /** purely visual, e.g. standing in for a letter that is read out elsewhere */
  decorative?: boolean;
  className?: string;
  style?: CSSProperties;
};

/** a box with the top-left and bottom-right corners rounded, inset by `i` (negative grows it) */
function box(i: number, r: number): string {
  const x0 = i;
  const y0 = i;
  const x1 = W - i;
  const y1 = H - i;
  return `M${x0 + r} ${y0}H${x1}V${y1 - r}A${r} ${r} 0 0 1 ${x1 - r} ${y1}H${x0}V${y0 + r}A${r} ${r} 0 0 1 ${x0 + r} ${y0}Z`;
}

const G =
  "M134 609A520 520 0 0 1 654 89H1156A520 520 0 0 1 1676 609V639H1329V635A250 250 0 0 0 1079 385H734A250 250 0 0 0 484 635V1338A250 250 0 0 0 734 1588H1079A250 250 0 0 0 1329 1338V1182H889V924H1676V1364A520 520 0 0 1 1156 1884H654A520 520 0 0 1 134 1364Z";

/**
 * The collective's "G" mark: a box rounded on two opposite corners with a
 * slab G knocked out of it, traced from the logo on gracecitycollective.com.
 * One path in currentColor with the G as a true cut-out, so whatever sits
 * behind the mark shows through the letter. `ruled` adds a hairline in the
 * seal's red traced around the box at a small distance, the way a bookplate
 * or a wax seal carries a second ring around its device.
 */
export default function GMark({
  size = 28,
  title = `${site.name} mark`,
  ruled = false,
  decorative = false,
  className,
  style,
}: GMarkProps) {
  const pad = ruled ? PAD : 0;
  const vw = W + 2 * pad;
  const vh = H + 2 * pad;
  const aspect = gMarkAspect(ruled);
  const dims =
    typeof size === "number"
      ? { width: size * aspect, height: size }
      : { width: `calc(${size} * ${aspect})`, height: size };
  const a11y = decorative ? { "aria-hidden": true as const } : { role: "img", "aria-label": title };
  return (
    <svg
      {...a11y}
      data-g-mark=""
      viewBox={`${-pad} ${-pad} ${vw} ${vh}`}
      className={className}
      style={{ ...dims, ...style }}
    >
      {ruled && (
        <path
          data-g-mark-rule=""
          d={box(-RULE_GAP, RULE_CORNER)}
          fill="none"
          stroke="var(--color-seal)"
          strokeWidth={RULE_WEIGHT}
          // a unit length, so a dash offset of 1 − f shows the first f of the rule
          pathLength={1}
        />
      )}
      <path fill="currentColor" fillRule="evenodd" d={`${box(0, CORNER)} ${G}`} />
    </svg>
  );
}
