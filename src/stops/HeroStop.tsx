import { useContext } from "react";

import { IntroPendingContext } from "@/app/contexts";
import { serif } from "@/app/styles";
import Kicker from "@/components/panel/Kicker";
import type { SceneSection } from "@/content/site";
import HeroLockup from "@/stops/HeroLockup";
import { between, stopFrame } from "@/stops/tuck";

/** the hero stop: the one headline over the scene, and the lockup at its foot below lg */
export default function HeroStop({ section: s }: { section: SceneSection }) {
  const pending = useContext(IntroPendingContext);
  const { base } = stopFrame(s.id);
  return (
    <section
      id={s.id}
      data-screen-label={s.label}
      // below lg the lockup is the hero's last child, set into the same
      // corner the chrome pins it to on desktop; lg and up the padding
      // clears the pinned one
      className={`${base} flex-col pt-[clamp(112px,17vh,180px)] pb-[clamp(22px,4.2vw,52px)] lg:pb-[clamp(150px,24vh,220px)]`}
    >
      <Kicker className="mb-[22px]" drawn={!pending}>
        {s.kicker}
      </Kicker>
      {/* the one headline the nearest figures may clip at its edges; it
          rises line by line once the splash has handed off (heroRise.ts) */}
      <h1
        data-hero-headline=""
        className={`${between} max-w-[15ch] text-[clamp(42px,9vw,72px)] leading-[1.02] tracking-[-0.005em] text-pretty lg:text-[clamp(42px,5.6vw,84px)] ${serif}`}
      >
        {s.heading}
      </h1>
      <HeroLockup at="foot" />
    </section>
  );
}
