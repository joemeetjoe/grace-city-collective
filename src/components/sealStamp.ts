import { gsap } from "@/lib/gsap";

/** the squash-and-rebound of the press */
export const STAMP_SECONDS = 0.5;

const part = (seal: SVGSVGElement, name: string) => seal.querySelector<SVGElement>(`[data-seal="${name}"]`);
const present = (...els: (SVGElement | null)[]) => els.filter((el): el is SVGElement => el !== null);

/**
 * The press: a quick squash of the seal as the fleur-de-lis and its emboss
 * lighting come up. Self-contained — it shows the live overlay for its
 * duration, returns it to whatever state it rested in (hidden on the hero
 * seal, which shows a cached raster instead), and clears every prop it
 * touched, so it can be replayed without stacking.
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
