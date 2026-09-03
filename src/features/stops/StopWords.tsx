import type { ComponentProps, ReactNode } from "react";
import type { VariantProps } from "class-variance-authority";

import type { Link } from "@/content/site";
import Kicker from "@/ui/panel/Kicker";
import PanelReveal from "@/ui/panel/PanelReveal";
import { button, stopBody, stopHeading } from "@/theme/classes";
import { revealRef } from "@/state/revealTargets";

/** the stops whose type sizes stopHeading sets */
type WordsStop = NonNullable<VariantProps<typeof stopHeading>["stop"]>;
/** of those, the ones with body copy (stopBody): the hero and the gatherings set a headline alone */
type BodyStop = NonNullable<VariantProps<typeof stopBody>["stop"]>;

export type StopWordsProps = {
  /** the kicker over the headline, and its manners (a margin, when to draw its rule, centred) */
  kicker?: ReactNode;
  kickerProps?: Omit<ComponentProps<typeof Kicker>, "children">;
  heading: ReactNode;
  /** a call to action under the words */
  cta?: Link;
  /**
   * wrap the headline, paragraphs and call to action in the panel's reveal
   * (PanelReveal) with these classes, so they rise in with its brackets one
   * after another; without it they stand bare, for a caller with a rise of
   * its own (the visit stop's way-in words)
   */
  reveal?: string;
  /** the kicker rises in the reveal with the rest, first, rather than standing before it with its rule drawn by the brackets */
  kickerRises?: boolean;
} & (
  | { stop: BodyStop; body?: string[] }
  | { stop: Exclude<WordsStop, BodyStop>; body?: undefined }
);

/**
 * A stop's words (#121): its kicker, its headline at the stop's own type size
 * (stopHeading), its paragraphs (stopBody) and its call to action, in that
 * order. The hero's headline is the page's one h1, registered for the intro
 * to settle once the splash is gone (state/revealTargets.ts) — the one the nearest
 * figures may clip at its edges; it rises line by line once the splash has
 * handed off (heroRise.ts), and its measure is written in em, so the
 * metric-matched fallback face wraps it at the same width before the woff2
 * lands (stopHeading). Every other stop's is an h2. The words go to the
 * reveal as a list, not a fragment: Reveal numbers its direct children for
 * the stagger, and a fragment would count as one.
 */
export default function StopWords(props: StopWordsProps) {
  const { kicker, kickerProps, heading, cta, reveal, kickerRises = false } = props;
  const words: ReactNode[] = [
    props.stop === "hero" ? (
      <h1 key="heading" ref={revealRef("headline")} data-hero-headline="" className={stopHeading({ stop: "hero" })}>
        {heading}
      </h1>
    ) : (
      <h2 key="heading" className={stopHeading({ stop: props.stop })}>
        {heading}
      </h2>
    ),
    ...(props.body?.map((p) => (
      <p key={p} className={stopBody({ stop: props.stop })}>
        {p}
      </p>
    )) ?? []),
  ];
  if (cta) {
    words.push(
      <a key="cta" href={cta.href} className={button({ intent: "seal", size: "cta" })}>
        {cta.label}
      </a>,
    );
  }
  const kickerBlock = kicker != null && (
    <Kicker key="kicker" {...kickerProps}>
      {kicker}
    </Kicker>
  );
  if (reveal == null) {
    return (
      <>
        {kickerBlock}
        {words}
      </>
    );
  }
  return (
    <>
      {!kickerRises && kickerBlock}
      <PanelReveal className={reveal}>
        {kickerRises && kickerBlock}
        {words}
      </PanelReveal>
    </>
  );
}
