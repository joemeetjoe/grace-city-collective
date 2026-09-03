import { memo, useMemo, type CSSProperties, type Ref } from "react";

import { RULE_WEIGHT, gMarkAspect } from "./gMarkGeometry";
import { G_MARK_D, G_MARK_RULE_D, G_MARK_RULED_VIEWBOX, G_MARK_VIEWBOX } from "./gMarkPaths";
import { useSite } from "@/content/useSite";

type GMarkProps = {
  /** rendered height: px as a number, or any CSS length (e.g. "0.63em") */
  size?: number | string;
  title?: string;
  /** a second, finer rule traced around the outside of the box, in the seal's red */
  ruled?: boolean;
  /** purely visual, e.g. standing in for a letter that is read out elsewhere */
  decorative?: boolean;
  className?: string;
  style?: CSSProperties;
  ref?: Ref<SVGSVGElement>;
};

const HIDDEN = { "aria-hidden": true as const };

/** width over height of the rendered svg, with or without the rule */
const ASPECT = { plain: gMarkAspect(false), ruled: gMarkAspect(true) };

/**
 * The collective's "G" mark: a box rounded on two opposite corners with a
 * slab G knocked out of it, traced from the logo on gracecitycollective.com
 * (gMarkPaths.ts). One path in currentColor with the G as a true cut-out,
 * so whatever sits behind the mark shows through the letter. `ruled` adds a
 * hairline in the seal's red traced around the box at a small distance, the
 * way a bookplate or a wax seal carries a second ring around its device.
 */
function GMark({
  size = 28,
  title,
  ruled = false,
  decorative = false,
  className,
  style,
  ref,
}: GMarkProps) {
  const site = useSite();
  const sized = useMemo<CSSProperties>(() => {
    const aspect = ruled ? ASPECT.ruled : ASPECT.plain;
    const dims =
      typeof size === "number"
        ? { width: size * aspect, height: size }
        : { width: `calc(${size} * ${aspect})`, height: size };
    return { ...dims, ...style };
  }, [size, ruled, style]);
  const a11y = decorative ? HIDDEN : { role: "img", "aria-label": title ?? `${site.name} mark` };
  return (
    <svg
      {...a11y}
      data-g-mark=""
      viewBox={ruled ? G_MARK_RULED_VIEWBOX : G_MARK_VIEWBOX}
      className={className}
      style={sized}
      ref={ref}
    >
      {ruled && (
        <path
          data-g-mark-rule=""
          d={G_MARK_RULE_D}
          fill="none"
          stroke="var(--color-seal)"
          strokeWidth={RULE_WEIGHT}
          // a unit length, so a dash offset of 1 − f shows the first f of the rule
          pathLength={1}
        />
      )}
      <path fill="currentColor" fillRule="evenodd" d={G_MARK_D} />
    </svg>
  );
}

export default memo(GMark);
