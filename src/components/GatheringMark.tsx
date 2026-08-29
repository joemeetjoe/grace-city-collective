import { lozengePath } from "@/components/lozenge";
import type { GatheringMark as Mark } from "@/content/site";
import { cn } from "@/lib/utils";

export type GatheringMarkProps = {
  mark: Mark;
  /** rendered size, px (the drawing is 44 square) */
  size?: number;
  className?: string;
};

const BOX = 44;

/** the ratio of a lozenge's width to its height, the finials' own */
const LOZENGE = 2;

/**
 * The five house churches: five hollow lozenges in a ring around one small
 * lozenge at the centre — five rooms about one table.
 */
function homes(): string[] {
  const c = { x: BOX / 2, y: BOX / 2 + 1 };
  const r = 15;
  const w = 12;
  const paths: string[] = [];
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    paths.push(lozengePath(c.x + r * Math.cos(a), c.y + r * Math.sin(a), w, w / LOZENGE));
  }
  paths.push(lozengePath(c.x, c.y, 6, 6 / LOZENGE));
  return paths;
}

/**
 * The all-church gathering: three lozenges nested one inside the next —
 * the five rooms become one, the whole family in one place.
 */
function feast(): string[] {
  const c = { x: BOX / 2, y: BOX / 2 };
  return [40, 26, 12].map((w) => lozengePath(c.x, c.y, w, w / LOZENGE));
}

const DRAW: Record<Mark, () => string[]> = { homes, feast };

/**
 * A small emblem for a gathering, in the finials' hollow-lozenge hairline
 * (OrnateRule) and in currentColor, so it takes the seal's red from the
 * kicker beside it.
 */
export default function GatheringMark({ mark, size = BOX, className }: GatheringMarkProps) {
  return (
    <svg
      aria-hidden
      data-gathering-mark={mark}
      width={size}
      height={size}
      viewBox={`0 0 ${BOX} ${BOX}`}
      className={cn("shrink-0", className)}
    >
      {DRAW[mark]().map((d) => (
        <path key={d} d={d} fill="none" stroke="currentColor" strokeWidth="1" />
      ))}
    </svg>
  );
}
