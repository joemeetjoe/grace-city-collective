import type { CSSProperties } from "react";

import {
  G_MARK_CORNER as CORNER,
  G_MARK_H as H,
  G_MARK_LETTER as G,
  G_MARK_W as W,
  gMarkBox as box,
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
  const a11y = decorative
    ? { "aria-hidden": true as const }
    : { role: "img", "aria-label": title };
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
      <path
        fill="currentColor"
        fillRule="evenodd"
        d={`${box(0, CORNER)} ${G}`}
      />
    </svg>
  );
}
