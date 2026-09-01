import { gMarkAspect } from "../marks/gMarkGeometry";

/** the mark's share of the shorter viewport side */
export const SPLASH_MARK_FRACTION = 0.72;

/** as tall as the viewport allows, or as wide, whichever binds first */
export const SPLASH_MARK_SIZE = `min(${SPLASH_MARK_FRACTION * 100}svh, calc(${SPLASH_MARK_FRACTION * 100}vw / ${gMarkAspect(true)}))`;
