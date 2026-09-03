import { gMarkAspect } from "../../marks/gMarkGeometry";
import { SPLASH_COMPOSITION } from "./splashComposition";

/** the mark's share of the viewport's height, and of its width (splashComposition.ts) */
export const SPLASH_MARK_SVH = SPLASH_COMPOSITION.markSvh;
export const SPLASH_MARK_VW = SPLASH_COMPOSITION.markVw;

/** as tall as its share of the height allows, or as wide as its share of the width, whichever binds first */
export const SPLASH_MARK_SIZE = `min(${SPLASH_MARK_SVH}svh, calc(${SPLASH_MARK_VW}vw / ${gMarkAspect(true)}))`;
