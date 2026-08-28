import { REDUCED_MOTION_QUERY } from "@/intro/introPolicy";
import { readSaveData } from "@/scene/tier";

/**
 * When the WebGL scene stands down for the still poster: no WebGL context,
 * the visitor prefers reduced motion, or asked for reduced data.
 */

export type FallbackInputs = {
  /** a WebGL context can be created */
  webgl: boolean;
  /** `prefers-reduced-motion: reduce` */
  reducedMotion: boolean;
  /** `navigator.connection.saveData` */
  saveData: boolean;
};

/** Pure: the poster stands in whenever any one signal says so. */
export function shouldUseStaticFallback({ webgl, reducedMotion, saveData }: FallbackInputs): boolean {
  return !webgl || reducedMotion || saveData;
}

/** probe for a WebGL context on a scratch canvas; a throwing or missing getContext reads as "no WebGL" */
export function detectWebgl(doc: Document = document): boolean {
  try {
    const canvas = doc.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export type FallbackSeams = {
  doc?: Document;
  matchMedia?: typeof window.matchMedia;
  nav?: Navigator;
};

/** gather the fallback inputs from the browser (every seam injectable for tests) */
export function readFallbackInputs({
  doc = document,
  matchMedia = window.matchMedia,
  nav = navigator,
}: FallbackSeams = {}): FallbackInputs {
  return {
    webgl: detectWebgl(doc),
    reducedMotion: matchMedia?.(REDUCED_MOTION_QUERY).matches ?? false,
    saveData: readSaveData(nav),
  };
}
