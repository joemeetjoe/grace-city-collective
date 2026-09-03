import type * as THREE from "three";

import type { TierName } from "@/device/tier";


/**
 * The scene is drawn to two canvases from one scene graph and one camera,
 * with the page's type between them: the back canvas carries the backdrop,
 * the crowd, the apostles' flames, the mid apostles, the arch, the dove and
 * the rays; the front canvas (transparent, pointer-events none, above the
 * DOM) carries the floor, the two nearest apostles on the left, the nearest
 * on the right and the embers — so a crown or an ember can cross the hero
 * headline, and a stop's copy panel can rise from behind a figure and rest
 * with a corner tucked behind him. The lockup sits in the bottom-left
 * corner, right over the two left apostles, so it stays above the front
 * canvas with the rest of the chrome: under it, the robes would hide it whole.
 *
 * What stays back, and why. fig10 (the praying apostle, z 2.3) is as near as
 * fig5, but its robe spans plate u 0.35–0.58, right across the middle of
 * the headline's lines at every aspect — and the lateral budget
 * (LATERAL_MAX) cannot move it clear. The flames stay back at the hero: a
 * front flame there would sit right across a word of the headline — the one
 * thing the split must never do. From who-we-are on, the two left apostles'
 * flames (flame5, flame6) come forward with them: at that stop they hover
 * over the panel's glass, clear of its words, and then lift off in front of
 * it (flamePose's ascent starts there). They go back for the visit stop,
 * where the flock rings under the dove right over the copy; both turns
 * happen with the flames clear of every panel. The DOM composites the front canvas
 * over the back one, so a back cut nearer than a front cut would draw under
 * it: that is only ever fig10 (z 2.3) against fig1 (z 2.1), and their cuts
 * share no pixels, so the two canvases draw what one did.
 */
export type CanvasSide = "back" | "front";

/** the floor, the two nearest apostles on the left and the nearest on the right */
const NEAR = ["floor", "fig13", "fig5", "fig1"];
/** the same, with the two left apostles' flames */
const NEAR_LIT = [...NEAR, "flame5", "flame6"];

/**
 * The cuts that cross in front of the type, one row per scene stop (the
 * site's scene sections, in order); a stop past the table takes the last
 * row. A cut that changes side between two rows pops from over a panel to
 * under it, so neighbouring rows may differ only in cuts that are clear of
 * both stops' panels at the turn (stopAt).
 */
export const FRONT_CUTS_AT: readonly ReadonlySet<string>[] = [
  new Set(NEAR), // hero — the flames would cross the headline
  new Set(NEAR_LIT), // who we are — the flames hover over the panel's glass
  new Set(NEAR_LIT), // house churches — and lift off in front of it
  new Set(NEAR_LIT), // gatherings
  new Set(NEAR_LIT), // give — the flames are above the frame by now
  new Set(NEAR), // visit — the flock rings under the dove, over the copy
];

export function frontCutsAt(stop: number): ReadonlySet<string> {
  const i = Math.max(0, Math.min(FRONT_CUTS_AT.length - 1, Math.floor(stop)));
  return FRONT_CUTS_AT[i];
}

/**
 * The stop whose row applies at scroll position `sp` (sections from the top,
 * fractional). The camera holds a stop's frame through the first half of its
 * section and travels through the second (engine/waypoints.ts), so the row
 * turns with the frame, at the half.
 */
export function stopAt(sp: number): number {
  return Math.round(Math.max(0, sp));
}

/**
 * On a phone every panel spans the frame, so the nearest hood (fig13, whose
 * robe fills the lower-left at the who-we-are stop) would sit on the words
 * rather than beside them, and its flame on the kicker. The hood overlaps
 * fig5's sleeve, so fig5 cannot stay in front without drawing over it: the
 * two left apostles and their flames all stay back on the mobile tier, at
 * every stop, and the phone keeps the floor and the right-hand apostle.
 */
const MOBILE_BACK: ReadonlySet<string> = new Set(["fig13", "fig5", "flame5", "flame6"]);

/** the embers are not cuts; they drift in front of everything */
export const EMBERS_SIDE: CanvasSide = "front";

/** which canvas a cut draws to at a stop, on a tier */
export function canvasFor(cut: { name: string }, stop = 0, tier: TierName = "desktop"): CanvasSide {
  if (tier === "mobile" && MOBILE_BACK.has(cut.name)) return "back";
  return frontCutsAt(stop).has(cut.name) ? "front" : "back";
}

/** a canvas and the renderer that draws to it */
export type RenderPass = {
  side: CanvasSide;
  renderer: Pick<THREE.WebGLRenderer, "render">;
};

/**
 * One frame: each pass sees only its own layer. The camera's mask is what
 * switches — the objects were assigned their side once, when built.
 */
export function renderPasses(scene: THREE.Scene, camera: THREE.Camera, passes: readonly RenderPass[]): void {
  for (const pass of passes) {
    camera.layers.set(layerMask(pass.side));
    pass.renderer.render(scene, camera);
  }
}

/** three.js layer index per canvas; the camera's mask is switched between the two render passes */
const LAYER: Record<CanvasSide, number> = { back: 0, front: 1 };

export function layerMask(side: CanvasSide): number {
  return LAYER[side];
}

export function assignLayer<T extends THREE.Object3D>(object: T, side: CanvasSide): T {
  object.layers.set(layerMask(side));
  return object;
}
