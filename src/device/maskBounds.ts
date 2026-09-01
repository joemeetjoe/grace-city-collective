/**
 * Each cut's mask bounding box on the plate (#69), measured from the packed
 * masks (tools/shots/mask-bboxes.json — the same data cdp-rects.mjs measures
 * overlaps with). Values are plate fractions [u0, v0, u1, v1] in image
 * coordinates, v down from the top.
 *
 * The cut planes used to be full-plate quads oversized by 1/FIT, so ~33
 * screen-covering rectangles were rasterised per frame while each figure
 * occupies a small window of the plate. A plane sized to its cut's padded
 * bounds rasterises only that window — the flames become slivers — and
 * three.js frustum culling starts doing real work on the tight boxes.
 */

type Bounds = [number, number, number, number];

const MEASURED: Record<string, Bounds> = {
  arch: [0.01, 0.048, 0.32, 0.484],
  crowd: [0.0, 0.4, 0.998, 0.813],
  dove: [0.455, 0.021, 0.562, 0.048],
  fig0: [0.004, 0.476, 0.178, 0.752],
  fig1: [0.621, 0.497, 0.957, 0.83],
  fig10: [0.359, 0.43, 0.57, 0.798],
  fig12: [0.672, 0.473, 0.766, 0.8],
  fig13: [0.084, 0.498, 0.422, 0.865],
  fig2: [0.143, 0.479, 0.291, 0.8],
  fig3: [0.777, 0.475, 0.99, 0.813],
  fig4: [0.016, 0.517, 0.262, 0.798],
  fig5: [0.1, 0.459, 0.371, 0.822],
  fig6: [0.316, 0.446, 0.482, 0.8],
  fig7: [0.697, 0.478, 0.92, 0.798],
  fig8: [0.504, 0.438, 0.717, 0.798],
  fig9: [0.482, 0.463, 0.611, 0.752],
  flame0: [0.111, 0.382, 0.121, 0.437],
  flame1: [0.177, 0.448, 0.187, 0.488],
  flame10: [0.573, 0.326, 0.586, 0.398],
  flame11: [0.628, 0.382, 0.646, 0.464],
  flame12: [0.701, 0.392, 0.715, 0.45],
  flame13: [0.753, 0.368, 0.767, 0.454],
  flame14: [0.882, 0.399, 0.896, 0.447],
  flame2: [0.184, 0.41, 0.198, 0.483],
  flame3: [0.19, 0.422, 0.193, 0.427],
  flame4: [0.188, 0.444, 0.2, 0.482],
  flame5: [0.295, 0.344, 0.309, 0.426],
  flame6: [0.361, 0.364, 0.378, 0.444],
  flame7: [0.406, 0.375, 0.416, 0.413],
  flame8: [0.479, 0.326, 0.492, 0.402],
  flame9: [0.531, 0.392, 0.541, 0.444],
  floor: [0.0, 0.779, 0.998, 0.998],
};

/**
 * Pad around the measured box, in plate fractions: room for the masks' soft
 * edges and for the relief displacement's shrink toward the camera axis,
 * which pulls a vertex inward by up to a few hundredths of the plate.
 */
export const MASK_PAD = 0.04;

/**
 * How far past the plate a padded box may run. The border fade in the cut
 * shader plays out over plate uv −0.004…0.010 (and its mirror), so a box
 * clamped a hair past the plate keeps every faded pixel a full-plate plane
 * would have drawn.
 */
const OVERRUN = 0.01;

export type MaskBounds = Bounds;

/** a cut's padded box, or undefined for an unmeasured cut (it keeps its full plane) */
export function maskBounds(name: string, pad = MASK_PAD): MaskBounds | undefined {
  const b = MEASURED[name];
  if (!b) return undefined;
  return [
    Math.max(-OVERRUN, b[0] - pad),
    Math.max(-OVERRUN, b[1] - pad),
    Math.min(1 + OVERRUN, b[2] + pad),
    Math.min(1 + OVERRUN, b[3] + pad),
  ];
}

/**
 * The uv to bake into a subrect plane's vertex so the vertex shader's
 * mapping — plate uv = (uv − 0.5) / fit + 0.5 — reconstructs the plate
 * position the vertex actually covers. `x`, `y` are the PlaneGeometry's own
 * uv (y = 1 at the top row); the bounds' image v runs down, texture v up.
 */
export function bakeUv(x: number, y: number, [u0, v0, u1, v1]: MaskBounds, fit: number): [number, number] {
  const u = u0 + x * (u1 - u0);
  const v = 1 - v1 + y * (v1 - v0);
  return [(u - 0.5) * fit + 0.5, (v - 0.5) * fit + 0.5];
}
