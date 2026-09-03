/**
 * The still poster's width ladder (#109): the rungs tools/poster/ladder.py
 * cuts from the 2048 plate, in AVIF with a WebP fallback, and the pure pick
 * a viewport makes among them. Three-free: StaticPoster imports this.
 */

/** rung widths in px, ascending — a srcset lists them in this order with `w` descriptors */
export const POSTER_RUNGS: readonly number[] = [640, 960, 1280, 1600, 2048];

export type PosterFormat = "avif" | "webp";

/** the `<source>` order: AVIF first, WebP for browsers without it */
export const POSTER_FORMATS: readonly PosterFormat[] = ["avif", "webp"];

export type PosterInputs = {
  /** viewport width in CSS px */
  width: number;
  /** devicePixelRatio */
  dpr: number;
  /** the visitor asked for reduced data (`navigator.connection.saveData`) */
  saveData: boolean;
};

export type PosterSource = {
  formats: readonly PosterFormat[];
  /** the rung width the viewport takes */
  rung: number;
};

/**
 * Pure: the poster covers the viewport width (`sizes="100vw"`), so it needs
 * `width × dpr` device pixels — the smallest rung at or above that, or the
 * largest rung when none reaches it. Save-Data takes the smallest rung
 * regardless. This is the browser's own srcset choice, written down so a
 * table can hold it to account.
 */
export function posterSource({ width, dpr, saveData }: PosterInputs, rungs = POSTER_RUNGS): PosterSource {
  const smallest = rungs[0];
  const largest = rungs[rungs.length - 1];
  if (saveData) return { formats: POSTER_FORMATS, rung: smallest };
  const need = width * dpr;
  const rung = rungs.find((w) => w >= need) ?? largest;
  return { formats: POSTER_FORMATS, rung };
}
