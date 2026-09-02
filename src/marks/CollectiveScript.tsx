import { memo, type JSX, type Ref, type SVGProps } from "react";

import { COLLECTIVE_STROKE, COLLECTIVE_VIEWBOX } from "./collectiveScriptMetrics";
import { COLLECTIVE_D } from "./collectiveScriptPaths";

type CollectiveScriptProps = { className?: string; title?: string; ref?: Ref<SVGSVGElement> } & Omit<
  SVGProps<SVGSVGElement>,
  "width" | "height" | "viewBox" | "ref"
>;

const VIEWBOX = `0 0 ${COLLECTIVE_VIEWBOX.width} ${COLLECTIVE_VIEWBOX.height}`;

/**
 * "Collective" in the roundhand of collectiveScriptPaths.ts, stroked in
 * currentColor at the one stroke width the resting lockup and the intro
 * share (collectiveScriptMetrics.ts).
 */
function CollectiveScript({ title = "Collective", ref, ...rest }: CollectiveScriptProps): JSX.Element {
  return (
    <svg
      role="img"
      aria-label={title}
      viewBox={VIEWBOX}
      preserveAspectRatio="xMinYMid meet"
      overflow="visible"
      ref={ref}
      {...rest}
    >
      <title>{title}</title>
      <path
        data-script="collective"
        d={COLLECTIVE_D}
        fill="none"
        stroke="currentColor"
        strokeWidth={COLLECTIVE_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default memo(CollectiveScript);
