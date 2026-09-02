import { useAppStore } from "@/state/appStore";
import Kicker from "@/ui/panel/Kicker";
import { stopFrame, stopHeading } from "@/theme/classes";
import HeroLockup from "./HeroLockup";
import type { StopProps } from "./Scene";

/** the hero stop: the one headline over the scene, and the lockup at its foot below lg */
export default function HeroStop({ section: s, ref }: StopProps) {
  // the splash is still up: the kicker's rule waits for the handoff
  const pending = useAppStore((s) => s.intro);
  const { base } = stopFrame(s.id);
  return (
    <section
      ref={ref}
      id={s.id}
      data-screen-label={s.label}
      // below lg the lockup is the hero's last child, set into the same
      // corner the chrome pins it to on desktop; lg and up the padding
      // clears the pinned one
      className={`${base} flex-col pt-[clamp(112px,17vh,180px)] pb-lockup-foot lg:pb-[clamp(150px,24vh,220px)]`}
    >
      <Kicker className="mb-[22px]" drawn={!pending}>
        {s.kicker}
      </Kicker>
      {/* the one headline the nearest figures may clip at its edges; it
          rises line by line once the splash has handed off (heroRise.ts).
          Its measure is written in em, so the metric-matched fallback face
          wraps it at the same width before the woff2 lands (stopHeading) */}
      <h1
        data-hero-headline=""
        className={stopHeading({ stop: "hero" })}
      >
        {s.heading}
      </h1>
      <HeroLockup at="foot" />
    </section>
  );
}
