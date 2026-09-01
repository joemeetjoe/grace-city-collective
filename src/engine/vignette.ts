import { tokens } from "@/theme/tokens";

/**
 * The scene's vignette: ink drawn over the frame's edges. The back canvas
 * wears it as a DOM gradient (vignetteCss); the front canvas is transparent
 * where nothing is drawn, so a DOM gradient over it would darken the type
 * between the canvases instead — its layers apply the same falloff in their
 * shaders (VIGNETTE_GLSL, transcribed from vignetteAlpha), which is what
 * keeps a figure's colour continuous across the split.
 */
export const VIGNETTE = {
  /** focus, as fractions of the frame from the top-left */
  at: [0.5, 0.38],
  /** ellipse radii, as fractions of the frame's width and height */
  radii: [0.8, 0.65],
  /** [distance along the radius, ink alpha]; clamps to the last past the ellipse */
  stops: [
    [0, 0],
    [0.65, 0.3],
    [1, 0.72],
  ],
} as const;

/** ink alpha at a point of the frame (fractions from the top-left) */
export function vignetteAlpha(x: number, y: number): number {
  const [cx, cy] = VIGNETTE.at;
  const [rx, ry] = VIGNETTE.radii;
  const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
  const [[, a0], [d1, a1], [d2, a2]] = VIGNETTE.stops;
  if (d <= d1) return a0 + ((a1 - a0) * d) / d1;
  if (d >= d2) return a2;
  return a1 + ((a2 - a1) * (d - d1)) / (d2 - d1);
}

function inkRgb(): [number, number, number] {
  const hex = tokens.ink;
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** the same falloff as a CSS radial gradient, for the DOM over the back canvas */
export function vignetteCss(): string {
  const [r, g, b] = inkRgb();
  const [cx, cy] = VIGNETTE.at;
  const [rx, ry] = VIGNETTE.radii;
  const stops = VIGNETTE.stops.map(([d, a]) => `${a === 0 ? "transparent" : `rgba(${r},${g},${b},${a})`} ${pct(d)}`);
  return `radial-gradient(ellipse ${pct(rx)} ${pct(ry)} at ${pct(cx)} ${pct(cy)}, ${stops.join(", ")})`;
}

const glslInk = inkRgb()
  .map((c) => (c / 255).toFixed(4))
  .join(", ");

/**
 * `vignetteAlpha(fragCoord, resolution)` and `uInk` for a fragment shader —
 * gl_FragCoord counts from the bottom-left, so the focus is flipped in y
 */
export const VIGNETTE_GLSL = `
const vec3 uInk = vec3(${glslInk});
float vignetteAlpha(vec2 frag, vec2 res) {
  vec2 p = frag / res - vec2(${VIGNETTE.at[0]}, ${1 - VIGNETTE.at[1]});
  float d = length(p / vec2(${VIGNETTE.radii[0]}, ${VIGNETTE.radii[1]}));
  float d1 = ${VIGNETTE.stops[1][0]};
  float a1 = ${VIGNETTE.stops[1][1]};
  float a2 = ${VIGNETTE.stops[2][1]};
  return d <= d1 ? a1 * d / d1 : mix(a1, a2, clamp((d - d1) / (1.0 - d1), 0.0, 1.0));
}`;
