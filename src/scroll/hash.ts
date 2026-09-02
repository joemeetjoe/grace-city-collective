/**
 * The location hash as the page's section address (#133): `#give` names a
 * section, the bare path names the top. Pure over string ids, like jump.ts;
 * the app's hook (app/useHashSync.ts) reads the store and decides when to
 * write. Every write is a replaceState — the history never gains an entry
 * for a scroll, so the back button leaves the page rather than stepping
 * back through its sections.
 */

/** the hash that names `id`; the top of the page has none, so a shared link to the top is the bare path */
export function hashFor<Id extends string>(id: Id, top: Id): string {
  return id === top ? "" : `#${id}`;
}

/**
 * The section a hash names, given the page's ids in order: an empty hash is
 * the top (the first id), a listed id is itself, and anything else is
 * nobody's — null, left alone.
 */
export function idFromHash<Id extends string>(hash: string, ids: readonly Id[]): Id | null {
  if (hash === "" || hash === "#") return ids[0] ?? null;
  const id = hash.startsWith("#") ? hash.slice(1) : null;
  return ids.find((known) => known === id) ?? null;
}

/**
 * Replace the location's hash in place — the path and the query kept, the
 * history untouched. Compares first: no write when the hash already reads
 * so. Returns whether it wrote.
 */
export function replaceHash(hash: string, win: Window = window): boolean {
  const { location, history } = win;
  if (location.hash === hash) return false;
  history.replaceState(null, "", `${location.pathname}${location.search}${hash}`);
  return true;
}

/** what the throttle reads the time off and schedules with; the wall clock unless a test says otherwise */
export type Clock = {
  now(): number;
  /** run `fn` in `ms`; returns the function that cancels it */
  after(ms: number, fn: () => void): () => void;
};

const wallClock: Clock = {
  now: () => performance.now(),
  after(ms, fn) {
    const timer = setTimeout(fn, ms);
    return () => clearTimeout(timer);
  },
};

export type Throttled<T> = {
  /** a value to write: at once when the window is open, else held for the trailing write */
  push(value: T): void;
  /** drop whatever is held, and its timer */
  cancel(): void;
};

/**
 * Write at most once per `ms`, and always the latest value: the first push
 * writes at once (the leading edge), pushes inside the window are held, and
 * the last of them is written when the window closes (the trailing edge),
 * which opens the next. A scroll through several sections at speed writes
 * the first and the last, not every one between.
 */
export function throttleLatest<T>(write: (value: T) => void, ms: number, clock: Clock = wallClock): Throttled<T> {
  let last = -Infinity;
  let held: { value: T } | null = null;
  let cancelTimer: (() => void) | null = null;
  const flush = () => {
    cancelTimer = null;
    if (!held) return;
    const { value } = held;
    held = null;
    last = clock.now();
    write(value);
  };
  return {
    push(value) {
      const elapsed = clock.now() - last;
      if (elapsed >= ms && !cancelTimer) {
        last = clock.now();
        write(value);
        return;
      }
      held = { value };
      cancelTimer ??= clock.after(ms - elapsed, flush);
    },
    cancel() {
      held = null;
      cancelTimer?.();
      cancelTimer = null;
    },
  };
}
