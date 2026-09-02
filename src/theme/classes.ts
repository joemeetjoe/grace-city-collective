import { cva } from "class-variance-authority";

import type { SceneId } from "../content/site";

/**
 * The site's shared Tailwind bundles, in one place: every class string more
 * than one component wears is built here, so what an element ends up with is
 * decided by construction — there is no merge step (tailwind-merge went in
 * #96): a caller's own utilities follow a bundle's, and a bundle never
 * carries a utility a caller is expected to override. The measures a bundle
 * shares with the stylesheet (the gutter, the frame's inset, a panel's
 * padding) are `--spacing-*` tokens in index.css, so `px-gutter` and a
 * `var(--spacing-gutter)` in a calc read one clamp. classes.test.ts holds
 * every bundle to the class list it replaced. Relative imports only: the
 * inline-head graph (staticSplash.ts) reaches here from vite.config.ts.
 */

/* ---- faces and measures ------------------------------------------------- */

/** the serif face with its metric-matched fallback: --font-serif in index.css (fonts.ts) */
export const serif = "font-serif";

/** the page gutter, every section's horizontal padding (--spacing-gutter) */
export const gutter = "px-gutter";

/* ---- stacking order ----------------------------------------------------- */

/**
 * The page's stacking order around the scene's two canvases (layerSplit.ts),
 * as Tailwind classes. The hero headline, the kickers and every copy panel —
 * glass, brackets and words — sit between the canvases, so the nearest
 * figures cross them; the lockup, the frame border and the nav stay above.
 * The splash's handoff sits over the headline (which fades up with the
 * scene) and under the nav, whose mark the travelling one lands on; the
 * splash itself and the mobile nav's sheet cover everything (the long-form,
 * scrolling up over the scene, sits between like the panels). gsap sets the
 * handoff's level inline, and the static splash writes its own into
 * index.html: both read the number out of the class (stackLevel).
 */
export const STACK = {
  back: "z-0",
  between: "z-10",
  handoff: "z-[15]",
  front: "z-[25]",
  copy: "z-30",
  nav: "z-40",
  cover: "z-50",
} as const;

export type StackStep = (typeof STACK)[keyof typeof STACK];

/** the z-index a step of STACK sets: `z-30` → 30, `z-[15]` → 15 */
export function stackLevel(step: StackStep): number {
  return Number(/^z-\[?(\d+)\]?$/.exec(step)![1]);
}

/**
 * Everything a scene section says sits between the canvases, so the nearest
 * figures cross it: a panel rises from behind them and rests with an edge
 * tucked behind one, its words placed clear.
 */
export const between = `relative ${STACK.between}`;

/* ---- glass -------------------------------------------------------------- */

/**
 * Lightly frosted glass, shared by the scene's copy panels, the nav and the
 * dot rail: a faint ink tint and a light blur, so the scene's flames, rays
 * and figures show through, with a hairline edge.
 */
export const GLASS = "bg-ink/15 backdrop-blur-md backdrop-saturate-125 border border-cream/10";

/** the G mark's shape at a small radius: rounded top-left and bottom-right only */
export const GLASS_CORNERS = "rounded-tl-[clamp(14px,1.6vw,22px)] rounded-br-[clamp(14px,1.6vw,22px)]";

/** the same shape on a button: rounded top-left and bottom-right at a button's scale */
export const BUTTON_CORNERS = "rounded-tl-[12px] rounded-br-[12px]";

/* ---- hover and focus manners: every link and button answers the pointer and the keyboard the same way ---- */

/** a hairline ring on keyboard focus only, stood off the element on ink, like the dot rail's */
export const FOCUS_RING =
  "outline-none focus-visible:ring-1 focus-visible:ring-cream/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

/** a text link: a hairline underline sweeps in from the left on hover (index.css) */
export const LINK_SWEEP = "link-sweep";

/** a button: it lifts a pixel and casts a soft glow of its own colour on hover, and settles on press (index.css) */
export const BUTTON_LIFT = "btn-lift";

/* ---- buttons ------------------------------------------------------------ */

/**
 * A call to action: filled in the seal's red (`seal`), lifting and glowing
 * under the pointer, or hollow (`ghost`), a cream hairline that brightens
 * with a cream glow. Sized for a panel's foot (`cta`) or the nav bar, where
 * the hollow one takes a little more padding and no weight (`navHollow`) to
 * sit level with the filled one (`nav`).
 */
export const button = cva(`${BUTTON_CORNERS} ${BUTTON_LIFT} ${FOCUS_RING}`, {
  variants: {
    intent: {
      seal: "bg-seal text-cream hover:bg-seal-deep",
      ghost: "border border-cream/45 [--lift-glow:var(--color-cream)] hover:border-cream hover:bg-cream/10",
    },
    size: {
      cta: "px-[34px] py-4 text-xs font-bold uppercase tracking-[0.2em]",
      nav: "px-6 py-3 text-[11px] font-bold uppercase tracking-[0.18em]",
      navHollow: "px-[22px] py-[11px] text-[11px] uppercase tracking-[0.18em]",
    },
  },
});

/**
 * The mobile nav's pills: Menu on the bar wears the desktop links' frosted
 * glass (the bar carries no backdrop of its own); on the solid ink sheet
 * Close stays bare, and Give and Join Sunday take the hollow and the filled
 * treatment without the lift.
 */
export const pill = cva(`${BUTTON_CORNERS} px-[22px] py-[13px] text-[11px] uppercase tracking-[0.18em] transition-colors`, {
  variants: {
    intent: {
      menu: `${GLASS} cursor-pointer text-cream/85 hover:text-cream`,
      close: "cursor-pointer text-cream/85 hover:text-cream",
      ghost: "border border-cream/45 hover:border-cream hover:bg-cream/10",
      seal: "bg-seal font-bold text-cream hover:bg-seal-deep",
    },
  },
});

/* ---- a section's words -------------------------------------------------- */

/** a section's kicker: small caps in the seal's red */
export const kicker = "text-[11px] uppercase tracking-[0.28em] text-seal";

/** a scene stop's copy panel: frosted glass between the canvases, padded, in the G mark's shape (Bracketed) */
export const panel = `${between} ${GLASS} p-panel-pad ${GLASS_CORNERS}`;

/**
 * A stop's headline, by stop: the who-we-are's sets a size smaller, as its
 * column gives up its right third to the two near apostles (TUCK); give's
 * and visit's are centred at a reading measure; the hero's is the one
 * headline the nearest figures may clip, with a measure of 15ch of
 * Cormorant written in em (its zero is 0.477em) so the metric-matched
 * fallback face wraps it at the same width before the woff2 lands (#106).
 * On a short desktop viewport (`short:`, ≤ 820px tall) each steps down a
 * size, so the panel stays one screen tall.
 */
export const stopHeading = cva(serif, {
  variants: {
    stop: {
      hero: `${between} max-w-[7.155em] text-[clamp(42px,9vw,72px)] leading-[1.02] tracking-[-0.005em] text-pretty lg:text-[clamp(42px,5.6vw,84px)]`,
      about: "text-[clamp(30px,2.8vw,48px)] short:lg:text-[36px] leading-[1.06] text-balance",
      houses: "text-[clamp(34px,4.1vw,58px)] leading-[1.06] text-balance",
      gatherings: "text-[clamp(30px,3.4vw,48px)] leading-[1.06] text-balance short:lg:text-[36px]",
      give: "max-w-[20ch] text-[clamp(40px,5.2vw,76px)] leading-[1.04] text-balance short:lg:text-[56px]",
      visit: "max-w-[20ch] text-[clamp(36px,4.2vw,56px)] leading-[1.04] text-balance short:lg:text-[42px]",
    },
  },
});

/**
 * A scene card's paragraphs below lg: the phone headline is ~30px to the
 * desktop's ~48px, so 16px Geist (a big x-height, uniform strokes)
 * out-weighs the hairline Cormorant beside it; a half-size down, more
 * leading and a hair lighter on the variable axis restores the desktop's
 * hierarchy.
 */
export const PHONE_BODY = "max-lg:text-[14.5px] max-lg:leading-[1.6] max-lg:font-[380]";

/**
 * A stop's body copy, by stop: a size up from md except the who-we-are's,
 * which steps down instead on a short viewport; give's and visit's sit at a
 * reading measure, give's narrower still on smaller desktops so the words
 * fit between the hood on the left and the apostle on the right (TUCK).
 */
export const stopBody = cva("text-base leading-relaxed text-pretty text-cream/80", {
  variants: {
    stop: {
      about: `short:lg:text-[14px] ${PHONE_BODY}`,
      houses: `md:text-lg ${PHONE_BODY}`,
      give: `max-w-[52ch] md:text-lg lg:max-w-[38ch] min-[1440px]:max-w-[40ch] 2xl:max-w-[44ch] short:lg:text-base ${PHONE_BODY}`,
      visit: `max-w-[52ch] md:text-lg short:lg:text-base ${PHONE_BODY}`,
    },
  },
});

/* ---- a stop's words beside a column ornament ----------------------------- */

/** a stop's column of words: the kicker, then the headline and paragraphs rising together */
export const STOP_COLUMN = "flex flex-col gap-5 md:gap-[26px]";

/**
 * The words beside a column ornament (the house table, the shared life):
 * the column, taking the panel's width less the ornament's and stood off
 * it from md up.
 */
export const WORDS_BESIDE = `${STOP_COLUMN} min-w-0 flex-1 md:pr-[clamp(24px,2.4vw,40px)]`;

/**
 * Where a stop's column ornament sits (HouseChurchesStop, AboutStop): from
 * md up in a column on the right of the words past a divider, the drawing
 * absolutely placed inside (ORNAMENT_IN_COLUMN) so it fills the column's
 * height (set by the words beside it) without ever adding to it; on a
 * phone, where the words need the whole width, under them at the panel's
 * left, its own height. The desktop column's width is each ornament's own:
 * the house table's the calendar's mirror; the shared life's the column
 * the who-we-are tuck clears for the two near apostles — never narrower
 * than the table's, so on a wide screen where the tuck is slight the words
 * give up the room instead.
 */
export const ornamentColumn = cva(
  "relative mt-5 shrink-0 md:mt-0 md:w-[clamp(72px,20vw,120px)] md:border-l md:border-cream/25 md:pl-[clamp(20px,2vw,32px)]",
  {
    variants: {
      ornament: {
        table: "lg:w-[clamp(150px,12vw,200px)]",
        life: "lg:w-[max(clamp(120px,9vw,160px),calc(var(--tuck)_-_var(--spacing-panel-pad)))]",
      },
    },
  },
);

/** the drawing in its column from md up: absolutely placed, the column's height, its width less the divider's padding */
export const ORNAMENT_IN_COLUMN =
  "w-[clamp(72px,20vw,120px)] md:absolute md:inset-y-1 md:right-0 md:h-[calc(100%_-_8px)] md:w-[calc(100%_-_clamp(20px,2vw,32px))]";

/* ---- a stop's frame and where its panel tucks ---------------------------- */

/**
 * Where each stop's panel tucks behind the nearest figures (the front cuts
 * of layerSplit.ts): extra padding on that side, so the glass runs on under
 * the figure while the words stop short of it. Who crosses what, at rest:
 * who we are — the panel steps in from the gutter and the two near apostles
 * on the left stand over its right third; house churches — the right-hand
 * apostle's head over the bottom edge; gatherings — the two left apostles'
 * heads over the lower-left corner, the right-hand one over the lower-right
 * (the space that clears them is the calendar's column, its divider running
 * under the heads); give — a hood over the left edge, so the panel steps
 * right and pads both sides to keep its words centred (the left band holds
 * the sown field, GiveSowing). Where a figure lands depends on both viewport
 * axes — the waypoints (PentecostParallax) fill the frame's height, and the
 * lateral budget clamps the frame's centre by its aspect — so the who-we-are
 * and gatherings tucks are linear fits in vw and vh to the figures' screen
 * positions measured at six sizes from 1280×720 to 2560×1440 (residuals
 * under 20px); who-we-are steps in from the gutter from 1440 up, and its
 * tuck is set per width range — the ranges are mutually exclusive because
 * Tailwind orders an arbitrary min-[] variant before lg, so a plain
 * min-[1440px]:[--tuck:…] would lose to lg:[--tuck:…]. Both tucks are a
 * --tuck variable rather than padding: the column each clears holds the
 * panel's ornament (GatheringsCalendar, AboutSharedLife). A tucked panel is
 * taller than it was, so those two sit up from the top of the frame rather
 * than centred, clear of the lockup; on a short viewport (≤ 820px) the
 * who-we-are and give type steps down a size as well (stopHeading). Give's
 * paragraphs also set narrower on smaller desktops, so the words fit
 * between the hood on the left and the apostle on the right (stopBody).
 * On a phone every panel spans the frame and the left apostles stay back
 * (layerSplit.ts), so nothing reaches a panel at rest there; the panels
 * only rise from behind the figures on the way in.
 */
export const TUCK: Partial<Record<SceneId, string>> = {
  about:
    "lg:self-start lg:mt-[clamp(96px,12vh,140px)] lg:pl-panel-pad lg:max-[1439px]:[--tuck:clamp(32px,calc(588px_-_22.7vw_+_4.8vh),320px)] min-[1440px]:ml-[clamp(24px,1.9vw,48px)] min-[1440px]:max-[1799px]:[--tuck:clamp(32px,calc(585px_-_20.8vw_+_4.8vh),340px)] min-[1800px]:[--tuck:clamp(32px,calc(505px_-_20.8vw_+_4.8vh),340px)]",
  gatherings:
    "lg:self-start lg:mt-[clamp(96px,12vh,140px)] lg:[--tuck:clamp(120px,calc(58.8vw_-_63.6vh_-_60px),420px)] lg:pb-[clamp(40px,calc(30vh_-_200px),120px)] 2xl:max-w-[1200px]",
  give: "lg:translate-x-[clamp(120px,9.4vw,160px)] lg:px-[clamp(120px,9.4vw,160px)]",
};

/**
 * A stop's section frame. No z-index: a section must not form a stacking
 * context, or its headline could never sit under the front canvas while its
 * copy sits over it. On desktop a section is one viewport: one camera
 * waypoint each, turned like pages. Below lg the scene scrolls natively
 * (#52) and a section is as tall as its words; the hero and the visit stop
 * keep a full viewport at every width: the first frame must not show the
 * next stop, and the scene's sticky canvas leaves with the last section, so
 * a short last section would take the dove away before the reader reached
 * it. A held section is lvh, the tallest the viewport ever gets on a phone:
 * at svh the next stop's card sits inside the first frame the moment the
 * URL bar retracts. The unheld sections keep svh — that is only a floor on
 * a desktop viewport, where the three are the same number. `clear`: below
 * lg the seal row sits over the top of every section and the lockup over
 * its foot; desktop keeps its unpadded frames.
 */
export function stopFrame(id: SceneId): { base: string; clear: string } {
  const holds = id === "hero" || id === "visit";
  const base = `relative flex ${holds ? "min-h-[100lvh]" : "lg:min-h-[100svh]"} ${gutter} max-lg:px-8`;
  const clear = "pt-[clamp(88px,11vh,110px)] pb-[clamp(72px,9vh,96px)] lg:py-0";
  return { base, clear };
}

/* ---- the long-form ------------------------------------------------------- */

/** the shell every long-form section wears: the page gutter and the tall vertical rhythm */
export const LONGFORM_SECTION = `scroll-mt-24 ${gutter} py-[clamp(56px,9vh,140px)] md:py-[clamp(80px,12vh,140px)]`;

/** a long-form section's column: centred at a reading width; the section adds its own gap */
export const longformContainer = "mx-auto flex max-w-[1080px] flex-col";

/** a long-form section's headline */
export const longformHeading = `text-[clamp(34px,4.1vw,58px)] leading-[1.06] ${serif}`;
