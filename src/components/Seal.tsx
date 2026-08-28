import { useId, type JSX, type SVGProps } from "react";

import { cssVar, mix, tokens, type Token } from "@/theme/tokens";

import { BAND, DRIP, FIELD, FLEUR, WAX } from "./sealPaths";

export type SealProps = {
  /** css size of the square mark, e.g. 28, "clamp(36px,6vw,86px)" */
  size?: number | string;
  /**
   * "static": filter-free, pre-flattened look for tiny sizes / after the stamp.
   * "live": the static artwork plus a `data-seal="live"` overlay carrying every
   * SVG filter (turbulence grain, diffuse/specular emboss, the pour's goo).
   * Hide the overlay and what remains is exactly the static seal.
   */
  variant?: "live" | "static";
  className?: string;
  /** accessible name */
  title?: string;
} & Omit<SVGProps<SVGSVGElement>, "width" | "height">;

/** square user-space, disc centred at 50,50 */
export const SEAL_VIEWBOX = 100;

/** token colour as a CSS var with the literal as fallback, so the mark survives without the stylesheet */
const c = (t: Token) => `var(${cssVar(t)}, ${tokens[t]})`;

/** pre-flattened tones: raised wax catches the flame, pressed wax falls into shadow */
const tone = {
  rimLit: mix(tokens.seal, tokens.sealHighlight, 0.18),
  field: mix(tokens.seal, tokens.sealDeep, 0.12),
  shade: mix(tokens.seal, tokens.sealDeep, 0.55),
  fleurLit: mix(tokens.seal, tokens.sealHighlight, 0.5),
  fleur: mix(tokens.seal, tokens.sealHighlight, 0.28),
  bandLit: mix(tokens.seal, tokens.sealHighlight, 0.58),
  edge: mix(tokens.sealHighlight, tokens.cream, 0.35),
};

/** the light sits top-left, as if the seal were lit by the flames */
const LIGHT = { azimuth: 225, elevation: 48, x: 8, y: 2, z: 90 };

export default function Seal({
  size = 28,
  variant = "live",
  className,
  title = "Grace City Collective seal",
  style,
  ...rest
}: SealProps): JSX.Element {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const ids = {
    body: `${id}-body`,
    face: `${id}-face`,
    glow: `${id}-glow`,
    clip: `${id}-clip`,
    wax: `${id}-wax`,
    emboss: `${id}-emboss`,
    goo: `${id}-goo`,
    impression: `${id}-impression`,
  };
  const live = variant === "live";

  return (
    <svg
      viewBox={`0 0 ${SEAL_VIEWBOX} ${SEAL_VIEWBOX}`}
      role="img"
      aria-label={title}
      className={className}
      style={{ width: size, height: size, ...style }}
      {...rest}
    >
      <title>{title}</title>
      <defs>
        <radialGradient id={ids.body} cx="0.36" cy="0.32" r="0.78">
          <stop offset="0" stopColor={tone.rimLit} />
          <stop offset="0.5" stopColor={c("seal")} />
          <stop offset="0.86" stopColor={tone.shade} />
          <stop offset="1" stopColor={c("sealDeep")} />
        </radialGradient>
        <linearGradient id={ids.face} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={tone.fleurLit} />
          <stop offset="1" stopColor={tone.fleur} />
        </linearGradient>
        <radialGradient id={ids.glow} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={c("sealHighlight")} stopOpacity="0.55" />
          <stop offset="1" stopColor={c("sealHighlight")} stopOpacity="0" />
        </radialGradient>
        <clipPath id={ids.clip}>
          <path d={WAX} />
        </clipPath>
      </defs>

      {/* the wax: an irregular disc with a raised rim around the pressed field */}
      <g data-seal="body">
        <path data-seal="wax" d={WAX} fill={`url(#${ids.body})`} />
        <path
          d={WAX}
          fill="none"
          stroke={c("sealDeep")}
          strokeWidth="3"
          strokeOpacity="0.5"
          clipPath={`url(#${ids.clip})`}
        />
        <path d={FIELD} fill={tone.field} />
        <path d={FIELD} fill="none" stroke={c("sealDeep")} strokeOpacity="0.45" strokeWidth="0.9" />
      </g>

      {/* the impression: fleur-de-lis with its band as its own, heavier shape */}
      <g data-seal="relief">
        <use href={`#${ids.impression}`} fill={c("sealDeep")} fillOpacity="0.8" transform="translate(1.1 1.2)" />
        <use href={`#${ids.impression}`} fill={tone.edge} fillOpacity="0.55" transform="translate(-0.6 -0.7)" />
        <g id={ids.impression}>
          <g fill={`url(#${ids.face})`}>
            <g data-seal="fleur">
              {(Object.keys(FLEUR) as (keyof typeof FLEUR)[]).map((k) => (
                <path key={k} d={FLEUR[k]} />
              ))}
            </g>
          </g>
          <g fill={tone.bandLit}>
            <path data-seal="band" d={BAND} />
          </g>
        </g>
      </g>

      {/* the warm specular: the flame's reflection on the wax */}
      <g clipPath={`url(#${ids.clip})`}>
        <ellipse
          data-seal="highlight"
          cx="30"
          cy="27"
          rx="21"
          ry="15"
          transform="rotate(-38 30 27)"
          fill={`url(#${ids.glow})`}
          opacity="0.8"
        />
      </g>

      {live && (
        /* everything that costs a filter pass, painted over the static base */
        <g data-seal="live">
          <filter
            id={ids.wax}
            x="-8"
            y="-8"
            width="116"
            height="116"
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="3" seed="11" result="mottle" />
            <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="2" seed="5" result="grain" />
            <feComposite in="mottle" in2="grain" operator="arithmetic" k2="0.75" k3="0.18" result="texture" />
            <feGaussianBlur in="SourceAlpha" stdDeviation="2.4" result="bevel" />
            <feComposite in="bevel" in2="texture" operator="arithmetic" k2="0.86" k3="0.06" result="bump" />
            <feDiffuseLighting in="bump" surfaceScale="5" diffuseConstant="1" lightingColor="#fff" result="diff">
              <feDistantLight azimuth={LIGHT.azimuth} elevation={LIGHT.elevation} />
            </feDiffuseLighting>
            <feComposite in="diff" in2="SourceGraphic" operator="arithmetic" k1="0.9" k3="0.18" result="lit" />
            <feSpecularLighting
              in="bump"
              surfaceScale="5"
              specularConstant="0.45"
              specularExponent="36"
              lightingColor={tokens.sealHighlight}
              result="spec"
            >
              <fePointLight x={LIGHT.x} y={LIGHT.y} z={LIGHT.z} />
            </feSpecularLighting>
            <feComposite in="spec" in2="SourceAlpha" operator="in" result="specIn" />
            <feComposite in="specIn" in2="lit" operator="arithmetic" k2="1" k3="1" result="shaded" />
            <feComposite in="shaded" in2="SourceAlpha" operator="in" />
          </filter>
          <filter
            id={ids.emboss}
            x="-10"
            y="-10"
            width="120"
            height="120"
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feTurbulence type="fractalNoise" baseFrequency="0.16" numOctaves="3" seed="4" result="grain" />
            <feGaussianBlur in="SourceAlpha" stdDeviation="1" result="bevel" />
            <feComposite in="bevel" in2="grain" operator="arithmetic" k2="0.95" k3="0.03" result="bump" />
            <feDiffuseLighting in="bump" surfaceScale="2.8" diffuseConstant="1" lightingColor="#fff" result="diff">
              <feDistantLight azimuth={LIGHT.azimuth} elevation={LIGHT.elevation} />
            </feDiffuseLighting>
            <feComposite in="diff" in2="SourceGraphic" operator="arithmetic" k1="0.9" k3="0.35" result="lit" />
            <feSpecularLighting
              in="bump"
              surfaceScale="2.8"
              specularConstant="0.7"
              specularExponent="30"
              lightingColor={tokens.sealHighlight}
              result="spec"
            >
              <fePointLight x={LIGHT.x} y={LIGHT.y} z={LIGHT.z} />
            </feSpecularLighting>
            <feComposite in="spec" in2="SourceAlpha" operator="in" result="specIn" />
            <feComposite in="specIn" in2="lit" operator="arithmetic" k2="1" k3="1" result="shaded" />
            <feComposite in="shaded" in2="SourceAlpha" operator="in" result="relief" />
            <feGaussianBlur in="SourceAlpha" stdDeviation="1.5" result="shadowBlur" />
            <feOffset in="shadowBlur" dx="1" dy="1.1" result="shadowOffset" />
            <feFlood floodColor={tokens.sealDeep} floodOpacity="0.6" result="shadowInk" />
            <feComposite in="shadowInk" in2="shadowOffset" operator="in" result="shadow" />
            <feMerge>
              <feMergeNode in="shadow" />
              <feMergeNode in="relief" />
            </feMerge>
          </filter>
          {/* goo: blur then crush the alpha so a falling bead reads as one liquid */}
          <filter
            id={ids.goo}
            x="-30"
            y="-150"
            width="160"
            height="300"
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.2" result="blur" />
            <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9" result="goo" />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>

          {/* the pour: a bead of wax that drops in and pools into the disc */}
          <g data-seal="pour" filter={`url(#${ids.goo})`}>
            <path data-seal="drip" d={DRIP} fill={`url(#${ids.body})`} visibility="hidden" />
          </g>

          {/* the wax under grain and flame light, and the flame's reflection */}
          <g data-seal="grain">
            <g filter={`url(#${ids.wax})`}>
              <path d={WAX} fill={`url(#${ids.body})`} />
              <path d={FIELD} fill={tone.field} fillOpacity="0.9" />
              <path d={FIELD} fill="none" stroke={c("sealDeep")} strokeOpacity="0.45" strokeWidth="0.9" />
            </g>
            <g clipPath={`url(#${ids.clip})`}>
              <ellipse
                cx="30"
                cy="27"
                rx="21"
                ry="15"
                transform="rotate(-38 30 27)"
                fill={`url(#${ids.glow})`}
                opacity="0.85"
              />
            </g>
          </g>

          {/* the impression embossed: lit relief with its own shadow */}
          <g data-seal="emboss" filter={`url(#${ids.emboss})`}>
            <use href={`#${ids.impression}`} />
          </g>
        </g>
      )}
    </svg>
  );
}
