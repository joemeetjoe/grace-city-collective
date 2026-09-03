import { memo, useMemo } from "react";

import { cn } from "@/lib/utils";
import { TILE_TRANSITION, tileStyle } from "./tileGeometry";

export type TileProps = {
  /** the tile's centre, in the drawing's units */
  cx: number;
  cy: number;
  /** the tile's path, drawn about its centre — or about its corner, with `pathTransform` bringing it to centre */
  d: string;
  pathTransform?: string;
  /** the pose about the tile's own centre (tile.ts) */
  transform: string;
  /** the tile's turn in the stagger, as CSS reads it */
  delay: string;
  /** whether the tile is in place; faded and posed out until then */
  shown: boolean;
  fill: string;
  fillOpacity: number;
  stroke: string;
  strokeOpacity: number;
  /** the transition utility, where a drawing needs a narrower one than TILE_TRANSITION */
  transition?: string;
  /** the tile's state classes (STATE) */
  className?: string;
};

/**
 * One tile of an ornament: the G mark's box in a hairline, placed at its
 * centre by an outer group and posed by an inner one, so the path keeps
 * its centring whatever the pose does. The pose group and the path both
 * transition on the same delay, so a tile's colour and its place move
 * together. Memoised: an ornament re-renders on every pointer change, and
 * only the tiles whose props changed need a new element tree; its style
 * objects hold identity across renders for the same pose.
 */
function Tile({
  cx,
  cy,
  d,
  pathTransform,
  transform,
  delay,
  shown,
  fill,
  fillOpacity,
  stroke,
  strokeOpacity,
  transition = TILE_TRANSITION,
  className,
}: TileProps) {
  const style = useMemo(() => tileStyle(transform, delay, shown), [transform, delay, shown]);
  const pathStyle = useMemo(() => ({ transitionDelay: delay }), [delay]);
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <g className={cn(transition, className)} style={style}>
        <path
          transform={pathTransform}
          d={d}
          fill={fill}
          fillOpacity={fillOpacity}
          stroke={stroke}
          strokeOpacity={strokeOpacity}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
          className={transition}
          style={pathStyle}
        />
      </g>
    </g>
  );
}

export default memo(Tile);
