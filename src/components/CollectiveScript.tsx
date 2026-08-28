import type { JSX, SVGProps } from "react";

import { COLLECTIVE_BASELINE, COLLECTIVE_STROKE, COLLECTIVE_VIEWBOX } from "./collectiveScriptMetrics";

export { COLLECTIVE_BASELINE, COLLECTIVE_STROKE, COLLECTIVE_VIEWBOX };

/**
 * "Collective" as a single hand-authored roundhand stroke. The path is drawn
 * as a stroke (never filled) so it can be revealed pen-style with DrawSVG.
 * It has three subpaths, in drawing order: the connected word, the t-bar,
 * and the i-dot.
 *
 * Authored upright on a grid (ascender 200, x-height 70, baseline 250) and
 * sheared to a ~63° slant; every join reuses the previous curve's tangent so
 * the letters connect without kinks. The one deliberate cusp is the c's
 * pointed top, which is what keeps a monoline c from reading as an e.
 */

const D = [
  // C
  "M 164.5 72 C 175.5 46 162.5 28 136.5 28 C 106.5 28 56.5 72 33 119 C 8 169 24.5 204 64.5 204 C 84.5 204 108.5 196 127.5 186",
  // o
  "C 147.4 175.5 196.5 196 210 169 C 219.5 150 214.5 134 199.5 134 C 184.5 134 163.5 150 154 169 C 144.5 188 149.5 204 164.5 204 C 179.5 204 200.5 188 210 169 C 216 157 230.5 140 242.5 140",
  // l
  "C 262.5 140 329.5 54 343.5 30 C 351.6 16 336.5 8 320.5 32 C 300.8 61.6 252.5 164 238.5 192 C 234.5 200 239 207 250.5 200",
  // l
  "C 265.6 190.8 299.5 152 312.5 136 C 335.8 107.4 403.5 54 417.5 30 C 425.6 16 410.5 8 394.5 32 C 374.8 61.6 326.5 164 312.5 192 C 308.5 200 313 207 324.5 200",
  // e
  "C 341.8 189.5 372.5 180 397.5 158 C 405.2 151.3 410.5 134 402 133 C 396.4 132.3 383.5 146 364.5 188 C 361.8 194 368.5 208 389.5 198",
  // c
  "C 400.6 192.7 436.9 162 468.5 138 C 464.5 130 446 135 433.5 156 C 426.4 167.9 417.5 196 425.5 204 C 428.8 207.3 436 203 444.5 194",
  // t
  "C 461.8 175.7 478.5 166 494.5 144 C 508.7 124.5 523.5 94 529.5 82 C 532 77 528.5 76 524.5 84 C 506.5 120 478.5 174 469.5 192 C 465.5 200 470 207 481.5 200",
  // i
  "C 503.1 186.8 519.5 164 541.5 136 C 532.5 154 517.5 184 513.5 192 C 509.5 200 514 207 525.5 200",
  // v
  "C 547.1 186.8 556.5 154 567.5 140 C 572 134.2 578.5 134 578.5 142 C 578.5 159.9 561 189 561 197 C 561 204.2 571.5 200 585.5 184 C 597 170.9 607.5 152 612.5 142 C 618.5 130 603.5 130 599 143 C 597.3 147.9 609.5 152 626.5 146",
  // e + flourish
  "C 644.4 139.7 627.5 180 652.5 158 C 660.2 151.3 665.5 134 657 133 C 651.4 132.3 638.5 146 619.5 188 C 616.8 194 623.5 208 644.5 198 C 700.1 171.5 761.5 144 796.5 154 C 847.4 168.6 856.5 184 891 181",
  // t-bar
  "M 495.5 128 C 507.5 124 519.5 124 528.5 126",
  // i-dot
  "M 558.5 102 C 558 103 557 105 556.5 106",
].join(" ");

export type CollectiveScriptProps = { className?: string; title?: string } & Omit<
  SVGProps<SVGSVGElement>,
  "width" | "height" | "viewBox"
>;

export default function CollectiveScript({ title = "Collective", ...rest }: CollectiveScriptProps): JSX.Element {
  return (
    <svg
      role="img"
      aria-label={title}
      viewBox={`0 0 ${COLLECTIVE_VIEWBOX.width} ${COLLECTIVE_VIEWBOX.height}`}
      preserveAspectRatio="xMinYMid meet"
      overflow="visible"
      {...rest}
    >
      <title>{title}</title>
      <path
        data-script="collective"
        d={D}
        fill="none"
        stroke="currentColor"
        strokeWidth={COLLECTIVE_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
