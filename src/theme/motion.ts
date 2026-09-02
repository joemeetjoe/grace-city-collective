/**
 * Motion tokens: the site's one easing curve and its durations. index.css
 * declares the same curve as `--ease-site` and each duration below as
 * `--duration-<name>` in its `@theme` block, so a CSS transition, a Tailwind
 * utility (`ease-site`) and a gsap tween all read one number; motion.test.ts
 * keeps the two in sync. Delays, staggers and the tweens' seconds are the
 * script's alone and live here as plain values. DOM-free, with no imports:
 * the inline-head graph (staticSplash.ts) reaches the theme by relative path.
 */

/* ---- the curve ---------------------------------------------------------- */

/** the site's ease, as the cubic-bezier index.css declares for `--ease-site` */
export const EASE_SITE_POINTS = [0.16, 1, 0.3, 1] as const;
/** the curve as CSS reads it, for an inline style or an arbitrary value */
export const EASE_SITE = "var(--ease-site)";

/* ---- durations, in ms: each is `--duration-<name>` in index.css --------- */

/** an entrance: a revealed block's rise, a bracket's slide home */
export const ENTER_MS = 1100;
/** a hairline draws (a card's rule, a kicker's), a gathering mark's lozenge traces, an ornament's tile prints */
export const DRAW_MS = 900;
/** an ornate rule's line grows */
export const LINE_MS = 1000;
/** a finial's lozenge traces */
export const LOZENGE_MS = 500;
/** a block's height settles on new words (SmoothHeight) */
export const SETTLE_MS = 700;
/** a button lifts, a link's underline sweeps */
export const LIFT_MS = 500;
/** a colour answers the pointer; the mobile nav sheet fades in */
export const QUICK_MS = 300;
/** a pressed button settles */
export const PRESS_MS = 120;
/** the mobile nav sheet fades out */
export const SHEET_OUT_MS = 150;
/** the wait between one revealed child and the next, and the words' lead over their hairline */
export const REVEAL_STAGGER_MS = 110;
export const REVEAL_LEAD_MS = 200;
/** the way in: a step's words rise; its emblem slides in below lg */
export const WAY_RISE_MS = 800;
export const WAY_SLIDE_MS = 600;
/** one round of the tour's house calls */
export const HOUSE_CALL_MS = 2500;
/** the sown field's hand-off (sowing.ts): a grain travels, a row fills, holds, and leaves; one step of the sequence is the three together */
export const SOW_TRAVEL_MS = 400;
export const SOW_FILL_MS = 300;
export const SOW_HOLD_MS = 100;
export const SOW_LEAVE_MS = 200;
export const SOW_STEP_MS = SOW_TRAVEL_MS + SOW_FILL_MS + SOW_HOLD_MS;

/** every duration by its `--duration-*` name in index.css (motion.test.ts) */
export const CSS_DURATIONS: Readonly<Record<string, number>> = {
  enter: ENTER_MS,
  draw: DRAW_MS,
  line: LINE_MS,
  lozenge: LOZENGE_MS,
  settle: SETTLE_MS,
  lift: LIFT_MS,
  quick: QUICK_MS,
  press: PRESS_MS,
  "sheet-out": SHEET_OUT_MS,
  "reveal-stagger": REVEAL_STAGGER_MS,
  "reveal-lead": REVEAL_LEAD_MS,
  "way-rise": WAY_RISE_MS,
  "way-slide": WAY_SLIDE_MS,
  "house-call": HOUSE_CALL_MS,
  "sow-travel": SOW_TRAVEL_MS,
  "sow-fill": SOW_FILL_MS,
  "sow-hold": SOW_HOLD_MS,
  "sow-leave": SOW_LEAVE_MS,
};

/* ---- delays and staggers, in ms (set inline by the script) --------------- */

/** a corner bracket's arms slide home one after the next */
export const BRACKET_STAGGER_MS = 140;
/** an ornate rule's large lozenges start this long after its line; the small ones this much later */
export const LOZENGE_AT_MS = 750;
export const LOZENGE_STAGGER_MS = 300;
/** a kicker's rule draws this long after its panel's brackets start */
export const KICKER_RULE_AT_MS = 300;
/** a gathering mark's lozenges trace one after the next */
export const MARK_TRACE_STAGGER_MS = 120;
/** on the tour, the wait between one home's call and the next: five calls make one round */
export const HOUSE_CALL_STAGGER_MS = 500;
/** an ornament's tiles print in one diagonal (or row, or seat) after the next */
export const TILE_STAGGER_MS = 50;
/** the way in's rule draws span by span */
export const RULE_STAGGER_MS = 160;
/** below lg a stop's ornament plays the pointer's part this long after it is in, and the gathering emblems light in turn this far apart */
export const ORNAMENT_LIT_AT_MS = 1200;
export const EMBLEM_LIT_STEP_MS = 400;

/* ---- the tweens, in seconds, and their gsap eases ------------------------ */

/** the hero headline's lines rise, one after another */
export const HERO_RISE_SECONDS = 1.2;
export const HERO_RISE_STAGGER = 0.12;
export const HERO_RISE_EASE = "power3.out";
/** the settle (#107): the lines, stood on the splash already, settle the last few px (heroRise.ts) one after another */
export const HERO_SETTLE_SECONDS = 1.0;
export const HERO_SETTLE_STAGGER = 0.08;

/** each piece of the nav arrives; the beat between pieces; when the calls to action and the dots start after the links */
export const NAV_REVEAL_SECONDS = 1.1;
export const NAV_REVEAL_STAGGER = 0.09;
export const NAV_REVEAL_ACTIONS_AT = 0.4;
export const NAV_REVEAL_DOTS_AT = 0.25;
export const NAV_REVEAL_EASE = "power3.out";

/** the short fade that stands in for the intro under reduced motion; a fade's ease */
export const RESTING_FADE_SECONDS = 0.4;
export const FADE_EASE = "power2.out";

/** the loading trace: the floor's run and pace, the glide's pace as a multiple of it, and the last stretch once the textures are in */
export const TRACE_MIN_SECONDS = 1.2;
export const TRACE_EASE = "power1.inOut";
export const TRACE_GLIDE_PACE = 1.25;
export const TRACE_GLIDE_EASE = "power1.out";
export const TRACE_FINISH_SECONDS = 0.35;
export const TRACE_FINISH_EASE = "power2.inOut";

/** the splash hands off: the mark travels to the nav while the ink fades */
export const HANDOFF_SECONDS = 0.8;
export const HANDOFF_EASE = "power3.inOut";

/** the smoothed scroll catches up with the wheel; an eased jump's and a page turn's curve */
export const SMOOTH_SECONDS = 1.1;
export const JUMP_EASE = "power2.inOut";
/** one page turn; a settle on the nearest section; how long after the last scroll update a settle sets off */
export const PAGE_SECONDS = 0.8;
export const SETTLE_SECONDS = 0.6;
export const SETTLE_DELAY_SECONDS = 0.1;
export const PAGE_EASE = "power2.inOut";

/* ---- the clock and the wheel, in ms --------------------------------------- */

/**
 * A frame that took longer than this (texture decode, the scene coming up
 * underneath) is counted as one short frame while the splash is up, so the
 * rule never leaps across a stall: gsap's own lag smoothing (trace.ts),
 * tightened from its 500 ms / 33 ms default.
 */
export const STALL_THRESHOLD_MS = 100;
export const STALL_COUNTED_MS = 16;

/** ms of quiet after which the next wheel event is a new gesture (wheelGesture.ts) */
export const WHEEL_REST_MS = 250;
/** the location hash follows the active section at most this often (scroll/hash.ts, app/useHashSync.ts) */
export const HASH_THROTTLE_MS = 250;
