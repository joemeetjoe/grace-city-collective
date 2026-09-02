import { memo, useId, useMemo, type CSSProperties, type JSX, type Ref, type SVGProps } from "react";

import { cssVar, mix, tokens, type Token } from "@/theme/tokens";

import { BAND, FIELD, FLEUR, SEAL_VIEWBOX, WAX } from "./sealPaths";

export type SealProps = {
  /** css size of the square mark, e.g. 28, "clamp(36px,6vw,86px)" */
  size?: number | string;
  className?: string;
  /** accessible name */
  title?: string;
  ref?: Ref<SVGSVGElement>;
} & Omit<SVGProps<SVGSVGElement>, "width" | "height" | "ref">;

const VIEWBOX = `0 0 ${SEAL_VIEWBOX} ${SEAL_VIEWBOX}`;

/** token colour as a CSS var with the literal as fallback, so the mark survives without the stylesheet */
const c = (t: Token) => `var(${cssVar(t)}, ${tokens[t]})`;
const SEAL_DEEP = c("sealDeep");

/** pre-flattened tones: one crimson wax, modelled only by light — lit faces warm toward the flame, recesses fall to sealDeep */
const tone = {
  lit: mix(tokens.seal, tokens.sealHighlight, 0.22),
  body: tokens.seal,
  shade: mix(tokens.seal, tokens.sealDeep, 0.5),
  field: mix(tokens.seal, tokens.sealDeep, 0.3),
  fieldLit: mix(tokens.seal, tokens.sealHighlight, 0.08),
  fieldShade: mix(tokens.seal, tokens.sealDeep, 0.55),
  floor: mix(tokens.seal, tokens.sealDeep, 0.5),
  floorDeep: mix(tokens.seal, tokens.sealDeep, 0.72),
  bandFloor: mix(tokens.seal, tokens.sealDeep, 0.36),
  edge: mix(tokens.sealHighlight, tokens.cream, 0.4),
  gloss: mix(tokens.sealHighlight, tokens.cream, 0.55),
};

/** a shading pass: a stroke's width and opacity, the widest and faintest first */
type Pass = readonly [width: number, opacity: number];

/** the outer bevel's shade, offset toward the flame's far side */
const RIM_SHADE: readonly Pass[] = [
  [6.5, 0.22],
  [4.2, 0.3],
  [2.2, 0.45],
];
/** the dish: its top-left wall falls into shadow, its lower-right wall catches the flame */
const DISH_SHADE: readonly Pass[] = [
  [10, 0.18],
  [6.5, 0.26],
  [3.6, 0.36],
  [1.8, 0.5],
];
const DISH_LIGHT: readonly Pass[] = [
  [4, 0.16],
  [1.6, 0.45],
];
/** inside the recess: shadow under the top-left walls */
const RELIEF_SHADE: readonly Pass[] = [
  [3.2, 0.35],
  [1.4, 0.7],
];

const FLEUR_KEYS = Object.keys(FLEUR) as (keyof typeof FLEUR)[];

function Seal({
  size = 28,
  className,
  title = "Grace City Collective seal",
  style,
  ref,
  ...rest
}: SealProps): JSX.Element {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const ids = {
    body: `${id}-body`,
    face: `${id}-face`,
    glow: `${id}-glow`,
    clip: `${id}-clip`,
    impression: `${id}-impression`,
    fieldClip: `${id}-field`,
    dish: `${id}-dish`,
    reliefClip: `${id}-relief`,
  };
  const sized = useMemo<CSSProperties>(() => ({ width: size, height: size, ...style }), [size, style]);

  return (
    <svg viewBox={VIEWBOX} role="img" aria-label={title} className={className} style={sized} ref={ref} {...rest}>
      <title>{title}</title>
      <defs>
        <radialGradient id={ids.body} cx="0.38" cy="0.34" r="0.72">
          <stop offset="0" stopColor={tone.lit} />
          <stop offset="0.55" stopColor={tone.body} />
          <stop offset="0.9" stopColor={tone.shade} />
          <stop offset="1" stopColor={SEAL_DEEP} />
        </radialGradient>
        <linearGradient id={ids.dish} x1="0.15" y1="0.1" x2="0.85" y2="0.9">
          <stop offset="0" stopColor={tone.fieldShade} />
          <stop offset="0.45" stopColor={tone.field} />
          <stop offset="1" stopColor={tone.fieldLit} />
        </linearGradient>
        <linearGradient id={ids.face} x1="0.15" y1="0.1" x2="0.85" y2="0.9">
          <stop offset="0" stopColor={tone.floorDeep} />
          <stop offset="1" stopColor={tone.floor} />
        </linearGradient>
        <clipPath id={ids.reliefClip}>
          <use href={`#${ids.impression}`} />
        </clipPath>
        <radialGradient id={ids.glow} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={tone.gloss} stopOpacity="0.5" />
          <stop offset="0.6" stopColor={tone.gloss} stopOpacity="0.12" />
          <stop offset="1" stopColor={tone.gloss} stopOpacity="0" />
        </radialGradient>
        <clipPath id={ids.clip}>
          <path d={WAX} />
        </clipPath>
        <clipPath id={ids.fieldClip}>
          <path d={FIELD} />
        </clipPath>
      </defs>

      {/* the wax: a poured disc whose rim is bevelled by the light, around the die's sunken face */}
      <g data-seal="body">
        <path data-seal="wax" d={WAX} fill={`url(#${ids.body})`} />
        <g clipPath={`url(#${ids.clip})`}>
          {/* the outer bevel: lit on the flame side, falling into shade opposite */}
          <path d={WAX} fill="none" stroke={tone.lit} strokeWidth="1.6" strokeOpacity="0.9" transform="translate(-0.9 -1)" />
          {RIM_SHADE.map(([w, o]) => (
            <path key={w} d={WAX} fill="none" stroke={SEAL_DEEP} strokeWidth={w} strokeOpacity={o} transform="translate(1.5 1.7)" />
          ))}
        </g>
        <path d={FIELD} fill={`url(#${ids.dish})`} />
        <g clipPath={`url(#${ids.fieldClip})`}>
          {DISH_SHADE.map(([w, o]) => (
            <path key={w} d={FIELD} fill="none" stroke={SEAL_DEEP} strokeWidth={w} strokeOpacity={o} transform="translate(2.2 2.4)" />
          ))}
          {DISH_LIGHT.map(([w, o]) => (
            <path key={w} d={FIELD} fill="none" stroke={tone.edge} strokeWidth={w} strokeOpacity={o} transform="translate(-1.4 -1.5)" />
          ))}
        </g>
      </g>

      {/* the impression: the die's fleur-de-lis pressed into the wax, its band a shade shallower */}
      <g data-seal="relief">
        {/* the lip of the recess catches light on the top-left, where the wax was pushed up */}
        <use href={`#${ids.impression}`} fill="none" stroke={tone.edge} strokeWidth="1.2" strokeOpacity="0.55" transform="translate(-0.5 -0.6)" />
        <use href={`#${ids.impression}`} fill="none" stroke={SEAL_DEEP} strokeWidth="1.2" strokeOpacity="0.5" transform="translate(0.6 0.7)" />
        <g id={ids.impression}>
          <g fill={`url(#${ids.face})`}>
            <g data-seal="fleur">
              {FLEUR_KEYS.map((k) => (
                <path key={k} d={FLEUR[k]} />
              ))}
            </g>
          </g>
          <g fill={tone.bandFloor}>
            <path data-seal="band" d={BAND} />
          </g>
        </g>
        <g clipPath={`url(#${ids.reliefClip})`}>
          {/* inside the recess: shadow under the top-left walls, light on the lower-right walls */}
          {RELIEF_SHADE.map(([w, o]) => (
            <use key={w} href={`#${ids.impression}`} fill="none" stroke={SEAL_DEEP} strokeWidth={w} strokeOpacity={o} transform="translate(1.2 1.4)" />
          ))}
          <use href={`#${ids.impression}`} fill="none" stroke={tone.edge} strokeWidth="1.3" strokeOpacity="0.8" transform="translate(-0.9 -1)" />
        </g>
      </g>

      {/* the warm specular: the flame's reflection on the wax */}
      <g clipPath={`url(#${ids.clip})`}>
        <ellipse
          data-seal="highlight"
          cx="31"
          cy="26"
          rx="24"
          ry="13"
          transform="rotate(-40 31 26)"
          fill={`url(#${ids.glow})`}
          opacity="0.9"
        />
      </g>
    </svg>
  );
}

/** The wax seal, a memoised leaf: its artwork is sealPaths.ts, its tones are settled once here. */
export default memo(Seal);
