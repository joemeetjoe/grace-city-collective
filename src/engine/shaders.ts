import { flameGlow, glslVec3, tokens } from "@/theme/tokens";
import { VIGNETTE_GLSL } from "./vignette";

/**
 * The cut material's two shaders. The vertex displacement is transcribed
 * from displaceLocal() in parallaxRelief.ts, where the projection-invariance
 * test pins the algebra.
 */
export const VERT = `
uniform float uFit;
uniform sampler2D depthMap;
uniform vec4 uDepthRect;
uniform float uRelief, uCamZ, uLayerZ, uScale;
varying vec2 vUv;
void main(){
  vUv = (uv - 0.5) / uFit + 0.5;
  vec3 p = position;
  // a cut's own depth map covers only its rect of the plate (depthRect)
  vec2 duv = (vUv - uDepthRect.xy) / uDepthRect.zw;
  // world-space push toward the camera; 0.5 is the plate's rest plane
  float dz = (texture2D(depthMap, duv).r - 0.5) * uRelief;
  // shrink toward the axis so the displaced vertex projects exactly where the
  // flat one did from the registration camera at (0,0,uCamZ)
  p.xy *= (uCamZ - uLayerZ - dz) / (uCamZ - uLayerZ);
  // the mesh is rescaled every frame, so a world dz must be applied in local units
  p.z += dz / uScale;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

export const FRAG = `
#define FLAME_EMBER ${glslVec3(tokens.seal)}
#define FLAME_BODY ${glslVec3(tokens.sealHighlight)}
#define FLAME_GLOW ${glslVec3(flameGlow)}
uniform sampler2D map, mask;
uniform vec4 uMapRect, uMaskChannel;
uniform float uBeam, uBeamMax, uFlameDrift, uIsFlame, uFlat, uVignette;
uniform vec2 uResolution;
varying vec2 vUv;
${VIGNETTE_GLSL}
void main(){
  vec2 uv = vUv;
  float edge = smoothstep(-0.004, 0.010, uv.x) * smoothstep(1.004, 0.990, uv.x)
             * smoothstep(-0.004, 0.010, uv.y) * smoothstep(1.004, 0.990, uv.y);
  // cuts fade to nothing outside the image; the backdrop clamps instead, so
  // looking past the plate shows wall rather than a void
  // the mask is one channel of a packed texture; uMaskChannel picks it
  float m = mix(dot(texture2D(mask, uv), uMaskChannel) * edge, 1.0, uFlat);
  // ~90% of a cut's plane is fully transparent (#65): bail before the colour
  // fetch and the blend. Below half an 8-bit LSB the blended contribution
  // quantises to nothing, so the soft edges are untouched; uFlat holds m at
  // 1, so the backdrop never discards
  if (m < 0.002) discard;
  // a cut's color map covers only its mapRect of the plate (the mask is
  // zero outside it, so nothing samples past the texture)
  vec3 col = texture2D(map, (uv - uMapRect.xy) / uMapRect.zw).rgb;

  float lum = dot(col, vec3(0.333));
  // a flame's mask carries a rim of dark wall; key it out (see flameKey())
  m *= 1.0 - uIsFlame + uIsFlame * smoothstep(0.16, 0.44, lum);
  // the tongues are recoloured on a luminance ramp in the seal's family —
  // crimson in the hollows, copper in the body, a warm glow at the tips — and
  // lifted, since the engraving draws them as mid-grey hatching
  vec3 fire = mix(FLAME_EMBER, mix(FLAME_BODY, FLAME_GLOW, smoothstep(0.45, 0.8, lum)), smoothstep(0.12, 0.45, lum))
            * (0.25 + lum * 1.5);
  col = mix(col, fire, uIsFlame);
  // the glow held at the old flicker's mean (#63): a still frame is a
  // repeatable frame, which is what lets the render loop stop at rest
  col += uIsFlame * uFlameDrift * pow(max(lum - 0.46, 0.0), 1.4) * 2.73 * FLAME_GLOW;

  // the light column as ILLUMINATION on every layer — the apostles' robes in
  // the beam are lit by it, which is what keeps their hatching legible at the
  // deep dolly; without it only the wall behind them is lit and they read as
  // dark bodies under bright faces. The volumetric rays are their own planes
  // (rayPlanes.ts), so this term is softer than the flat beam it replaces.
  // Measured against the plate, not the oversized plane, so it stays put;
  // clamped before pow(): a negative base is NaN in GLSL
  vec2 cv = clamp(uv, 0.0, 1.0);
  float spread = mix(0.055, 0.42, pow(1.0 - cv.y, 1.5));
  float bx = (cv.x - 0.5) / spread;
  float beam = exp(-bx * bx * 1.9) * smoothstep(-0.2, 0.85, cv.y);
  float dv = distance(cv * vec2(1.0, 1.22), vec2(0.5, 0.965 * 1.22));
  float halo = exp(-dv * dv * 180.0);
  col += (beam * 0.22 + halo * 0.34) * uBeam * uBeamMax * vec3(0.98, 0.90, 0.72);

  col = col / (1.0 + col * 0.30);
  col = pow(col, vec3(1.12)) * vec3(1.05, 1.0, 0.92);
  // the backdrop clamps rather than fading, so a frame that looks above the
  // plate's top edge gets its top row of pixels stretched down it — vertical
  // streaks with none of the engraving's hatch, which is the smear the dove
  // stop shows on a portrait frame. Run the wall out into the ink instead:
  // the room goes dark above the plate rather than smearing.
  col = mix(col, uInk, uFlat * smoothstep(0.998, 1.020, uv.y));
  // the back canvas wears the vignette as a DOM gradient; a front layer has
  // only the page under it, so it takes the same ink here
  col = mix(col, uInk, vignetteAlpha(gl_FragCoord.xy, uResolution) * uVignette);
  gl_FragColor = vec4(col, m);
}`;
