import type * as THREE from "three";

import type { Cut } from "./parallaxRelief";

/**
 * The scene is drawn to two canvases from one scene graph and one camera,
 * with the page's type between them: the back canvas carries the backdrop,
 * the crowd, the apostles' flames, the mid apostles, the arch, the dove and
 * the rays; the front canvas (transparent, pointer-events none, above the
 * DOM) carries the floor, the two nearest apostles on the left and the
 * embers — so a crown or an ember can cross the hero headline. The lockup
 * sits in the bottom-left corner, right over those two apostles, so it
 * stays above the front canvas with the rest of the chrome: under it, the
 * robes would hide it whole.
 *
 * What stays back, and why. fig10 (the praying apostle, z 2.3) is as near as
 * fig5, but its robe spans plate u 0.35–0.58, right across the middle of
 * the headline's lines at every aspect — and the lateral budget
 * (LATERAL_MAX) cannot move it clear. The flames stay back too, even
 * the ones over front figures: a flame hovers clear above its head (its cut
 * never overlaps the figure's), so nothing changes at rest, and at the hero
 * framing a front flame would sit right across a word of the headline —
 * the one thing the split must never do. Every front cut still sorts after
 * every back cut except fig10, whose cut shares no pixels with fig5's or
 * fig13's, so compositing the two canvases in the DOM draws what one did.
 */
export type CanvasSide = "back" | "front";

/** the cuts that cross in front of the type */
export const FRONT_CUTS: ReadonlySet<string> = new Set(["floor", "fig13", "fig5"]);

/** the embers are not cuts; they drift in front of everything */
export const EMBERS_SIDE: CanvasSide = "front";

/** which canvas a cut draws to */
export function canvasFor(cut: Pick<Cut, "name">): CanvasSide {
  return FRONT_CUTS.has(cut.name) ? "front" : "back";
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

/**
 * The page's stacking order around the two canvases, as Tailwind classes
 * (the handoff's is a bare number: gsap sets it inline). Only the hero
 * headline and the kicker rules sit under the front canvas; body copy, the
 * lockup, the frame border, cards, buttons and the nav stay above it. The
 * splash's handoff sits over the headline (which fades up with the scene)
 * and under the nav, whose mark the travelling one lands on.
 */
export const STACK = {
  back: "z-0",
  between: "z-10",
  handoff: 15,
  front: "z-[25]",
  copy: "z-30",
  nav: "z-40",
} as const;
