import { gsap } from "@/lib/gsap";

export type IntroTargets = {
  wordmark: HTMLElement;
  script: SVGSVGElement | null;
  seal: SVGSVGElement | null;
};

export type IntroLabel = "wordmark" | "collective" | "seal";

/** Where each beat starts, in seconds from the top of the intro. */
export const INTRO_LABELS: Record<IntroLabel, number> = { wordmark: 0, collective: 0.7, seal: 1.9 };

export type IntroBeat = {
  label: IntroLabel;
  /** add this beat's tweens to `tl`, positioned at `at` (its label) */
  add(tl: gsap.core.Timeline, targets: IntroTargets, at: IntroLabel): void;
};

export const WORDMARK_WIPE_SECONDS = 0.7;

/** A soft-edged mask sweeps left→right over "Grace City" while its tracking settles to rest. */
export const wordmarkBeat: IntroBeat = {
  label: "wordmark",
  add(tl, { wordmark }, at) {
    gsap.set(wordmark, {
      maskImage: "linear-gradient(90deg, #000 0%, #000 40%, transparent 60%)",
      webkitMaskImage: "linear-gradient(90deg, #000 0%, #000 40%, transparent 60%)",
      maskSize: "300% 100%",
      webkitMaskSize: "300% 100%",
      maskRepeat: "no-repeat",
      webkitMaskRepeat: "no-repeat",
      maskPosition: "100% 0%",
      webkitMaskPosition: "100% 0%",
      letterSpacing: "0.06em",
    });
    tl.to(
      wordmark,
      {
        maskPosition: "0% 0%",
        webkitMaskPosition: "0% 0%",
        letterSpacing: "0em",
        duration: WORDMARK_WIPE_SECONDS,
        ease: "power4.out",
      },
      at,
    );
  },
};

/**
 * The intro sequence. Labels are laid down first at fixed offsets so every
 * beat — including ones added later — lands in its own slot.
 */
export function buildIntroTimeline(targets: IntroTargets, beats: IntroBeat[] = [], vars: gsap.TimelineVars = {}) {
  const tl = gsap.timeline({ paused: true, ...vars });
  for (const [label, time] of Object.entries(INTRO_LABELS)) tl.addLabel(label, time);
  for (const beat of [wordmarkBeat, ...beats]) beat.add(tl, targets, beat.label);
  return tl;
}
