import { BUTTON_CORNERS } from "@/theme/glass";
import { BUTTON_LIFT, FOCUS_RING } from "@/theme/interact";

export const serif = "[font-family:'Cormorant_Garamond',Georgia,serif]";
export const gutter = "px-[clamp(20px,4.4vw,60px)]";
export const kickerCls = "text-[11px] uppercase tracking-[0.28em] text-seal";

/** the filled call to action, in the seal's red: it lifts and glows under the pointer */
export const SEAL_BUTTON = `${BUTTON_CORNERS} ${BUTTON_LIFT} ${FOCUS_RING} bg-seal text-cream hover:bg-seal-deep`;
/** the hollow call to action: a cream hairline that brightens, with a cream glow */
export const GHOST_BUTTON = `${BUTTON_CORNERS} ${BUTTON_LIFT} ${FOCUS_RING} border border-cream/45 [--lift-glow:var(--color-cream)] hover:border-cream hover:bg-cream/10`;
