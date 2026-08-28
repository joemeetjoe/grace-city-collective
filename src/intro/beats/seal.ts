import { DRIP, WAX } from "@/components/sealPaths";
import { gsap } from "@/lib/gsap";
import type { IntroBeat } from "@/intro/timeline";

/** the bead falls, then pools into the disc */
export const POUR_SECONDS = 0.55;
/** the squash-and-rebound of the press */
export const STAMP_SECONDS = 0.5;
/** the whole beat, including the hold on the finished seal */
export const SEAL_BEAT_SECONDS = 1.4;

/** how far above its resting place the bead starts, in seal user units */
const DRIP_DROP = 100;

const part = (seal: SVGSVGElement, name: string) => seal.querySelector<SVGElement>(`[data-seal="${name}"]`);
const present = (...els: (SVGElement | null)[]) => els.filter((el): el is SVGElement => el !== null);

/**
 * The press: a quick squash of the seal as the fleur-de-lis and its emboss
 * lighting come up. Self-contained — it shows the live overlay for its
 * duration, returns it to whatever state it rested in (hidden on the hero
 * seal, which shows a cached raster instead; showing in the splash), and
 * clears every prop it touched, so it can be replayed without stacking.
 */
export function stampTween(seal: SVGSVGElement, opts: { onLive?: (live: boolean) => void } = {}): gsap.core.Timeline {
  const overlay = part(seal, "live");
  const grain = part(seal, "grain");
  const emboss = part(seal, "emboss");
  const relief = part(seal, "relief");
  const lit = present(grain, emboss, relief);
  const tl = gsap.timeline();
  const restDisplay = overlay?.style.display === "none" ? "none" : "inline";

  tl.call(() => opts.onLive?.(true), [], 0);
  if (overlay) tl.set(overlay, { display: "inline" }, 0);

  // squash 1 → 0.94 → 1 about the centre
  tl.to(seal, { scale: 0.94, duration: STAMP_SECONDS * 0.32, ease: "power2.in" }, 0);
  tl.to(seal, { scale: 1, duration: STAMP_SECONDS * 0.68, ease: "back.out(2.5)" }, STAMP_SECONDS * 0.32);

  // the wax takes its grain as it is pressed; the impression rises with the rebound
  if (grain) tl.fromTo(grain, { autoAlpha: 0 }, { autoAlpha: 1, duration: STAMP_SECONDS * 0.4, ease: "power1.in" }, 0);
  tl.fromTo(
    present(relief, emboss),
    { autoAlpha: 0 },
    { autoAlpha: 1, duration: STAMP_SECONDS * 0.6, ease: "power2.out" },
    STAMP_SECONDS * 0.2,
  );

  // rest: filters off, nothing inline left behind (only the props touched —
  // clearing transforms on an SVG group makes gsap re-parse and leave an origin)
  tl.set(lit, { clearProps: "opacity,visibility" }, STAMP_SECONDS);
  tl.set(seal, { clearProps: "transform" }, STAMP_SECONDS);
  if (overlay) tl.set(overlay, { display: restDisplay }, STAMP_SECONDS);
  tl.call(() => opts.onLive?.(false), [], STAMP_SECONDS);
  return tl;
}

/**
 * Pour and press. A bead of wax drops from above the seal, pools into the
 * disc, and is stamped; the beat ends on the lit seal (overlay showing) so it
 * looks like wax while it waits on ink for the textures.
 */
export const sealBeat: IntroBeat = {
  label: "seal",
  add(tl, { seal }, at) {
    if (!seal) return;
    const overlay = part(seal, "live");
    const drip = part(seal, "drip");
    const body = part(seal, "body");
    const relief = part(seal, "relief");
    const highlight = part(seal, "highlight");
    const grain = part(seal, "grain");
    const emboss = part(seal, "emboss");
    const base = present(body, relief, highlight);

    // up front: no seal yet, just the bead waiting above the disc
    gsap.set(seal, { overflow: "visible" });
    gsap.set(base, { autoAlpha: 0 });
    gsap.set(present(grain, emboss), { autoAlpha: 0 });
    if (overlay) gsap.set(overlay, { display: "inline" });
    if (drip) gsap.set(drip, { autoAlpha: 1, y: -DRIP_DROP, attr: { d: DRIP } });

    // pour: the bead falls, lands, and spreads into the disc outline
    if (drip) {
      tl.to(drip, { y: 0, duration: POUR_SECONDS * 0.55, ease: "power2.in" }, at);
      tl.to(drip, { morphSVG: { shape: WAX }, duration: POUR_SECONDS * 0.55, ease: "power3.out" }, `${at}+=${POUR_SECONDS * 0.45}`);
      tl.set(drip, { autoAlpha: 0 }, `${at}+=${POUR_SECONDS}`);
    }
    if (body) tl.set(body, { autoAlpha: 1 }, `${at}+=${POUR_SECONDS}`);

    // press
    tl.add(stampTween(seal), `${at}+=${POUR_SECONDS}`);

    // rest: the lit seal, nothing else inline left behind
    tl.set(present(body, highlight), { clearProps: "opacity,visibility" }, `${at}+=${POUR_SECONDS + STAMP_SECONDS}`);
    if (drip) tl.set(drip, { clearProps: "all" }, `${at}+=${POUR_SECONDS + STAMP_SECONDS}`);
    tl.set(seal, { clearProps: "overflow" }, `${at}+=${POUR_SECONDS + STAMP_SECONDS}`);

    // hold on the finished seal
    tl.to({}, { duration: SEAL_BEAT_SECONDS - POUR_SECONDS - STAMP_SECONDS }, `${at}+=${POUR_SECONDS + STAMP_SECONDS}`);
  },
};
