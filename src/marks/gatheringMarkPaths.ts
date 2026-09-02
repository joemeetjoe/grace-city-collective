import { lozengePath } from "@/theme/lozenge";
import type { GatheringMark as Mark } from "@/content/site";

/**
 * The emblems GatheringMark draws, settled once: the two gatherings' marks,
 * and the three the way in (WayIn) adds before them — one alone, one met,
 * and a family at a table. Each is a list of lozenges in a 44-square
 * drawing, with how each moves when the mark is lit.
 */
export type Emblem = Mark | "one" | "two" | "table";

/** the drawing's square */
export const GATHERING_BOX = 44;

/** the ratio of a lozenge's width to its height, the finials' own */
const LOZENGE = 2;

/** how far a house steps out from the table when lit, px of the drawing */
const STEP_OUT = 2.5;
/** how far the feast's outer rings draw in toward the centre when lit */
const DRAW_IN = [0.72, 0.8];
/** how far the family draws in to the table, and the pastor toward the one waiting, when lit */
const DRAW_TO = 2.5;
const MEET = 4;

/** one lozenge, and how it moves when the mark is lit */
export type Piece = {
  d: string;
  /** its transform about its own centre when lit */
  lit?: string;
  /** whether it fills solid when lit */
  fills?: boolean;
  /** whether it is a home the tour calls on */
  home?: boolean;
};

/**
 * The five house churches: five hollow lozenges in a ring around one small
 * lozenge at the centre — five rooms about one table. Lit, the five step
 * out a little from the table, and the table fills.
 */
function homes(): Piece[] {
  const c = { x: GATHERING_BOX / 2, y: GATHERING_BOX / 2 + 1 };
  const r = 15;
  const w = 12;
  const pieces: Piece[] = [];
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    pieces.push({
      d: lozengePath(c.x + r * dx, c.y + r * dy, w, w / LOZENGE),
      lit: `translate(${(STEP_OUT * dx).toFixed(2)}px, ${(STEP_OUT * dy).toFixed(2)}px)`,
      home: true,
    });
  }
  pieces.push({ d: lozengePath(c.x, c.y, 6, 6 / LOZENGE), fills: true });
  return pieces;
}

/**
 * The all-church gathering: three lozenges nested one inside the next —
 * the five rooms become one, the whole family in one place. Lit, the outer
 * rings draw in toward the centre, and the centre fills.
 */
function feast(): Piece[] {
  const c = { x: GATHERING_BOX / 2, y: GATHERING_BOX / 2 };
  return [40, 26, 12].map((w, i) => ({
    d: lozengePath(c.x, c.y, w, w / LOZENGE),
    ...(i < DRAW_IN.length ? { lit: `scale(${DRAW_IN[i]})` } : { fills: true }),
  }));
}

/** One alone: a single lozenge at the centre, which fills when lit — the one writing to us. */
function one(): Piece[] {
  return [{ d: lozengePath(GATHERING_BOX / 2, GATHERING_BOX / 2, 12, 12 / LOZENGE), fills: true }];
}

/**
 * One met: the same lozenge, and a second a little way off to its right —
 * the pastor writing back. Lit, the second draws in beside the first, and
 * the first fills.
 */
function two(): Piece[] {
  const c = { x: GATHERING_BOX / 2, y: GATHERING_BOX / 2 };
  return [
    { d: lozengePath(c.x, c.y, 12, 12 / LOZENGE), fills: true },
    { d: lozengePath(c.x + 15, c.y, 12, 12 / LOZENGE), lit: `translate(-${MEET}px, 0px)` },
  ];
}

/**
 * A family at a table: four lozenges about one small lozenge at the centre
 * — dinner with the pastor's family. Lit, the four draw in to the table,
 * and the table fills.
 */
function table(): Piece[] {
  const c = { x: GATHERING_BOX / 2, y: GATHERING_BOX / 2 };
  const r = 14;
  const w = 11;
  const pieces: Piece[] = [];
  for (let i = 0; i < 4; i++) {
    const a = -Math.PI / 4 + (i * Math.PI) / 2;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    pieces.push({
      d: lozengePath(c.x + r * dx, c.y + r * dy, w, w / LOZENGE),
      lit: `translate(${(-DRAW_TO * dx).toFixed(2)}px, ${(-DRAW_TO * dy).toFixed(2)}px)`,
    });
  }
  pieces.push({ d: lozengePath(c.x, c.y, 6, 6 / LOZENGE), fills: true });
  return pieces;
}

/** every emblem's lozenges, drawn once at load */
export const EMBLEMS: Readonly<Record<Emblem, readonly Piece[]>> = {
  one: one(),
  two: two(),
  table: table(),
  homes: homes(),
  feast: feast(),
};
