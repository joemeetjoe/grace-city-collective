import { useAppStore } from "@/state/appStore";
import HeroLockup from "./HeroLockup";
import Stop, { type StopProps } from "./Stop";
import StopWords from "./StopWords";

/** the hero stop: the one headline over the scene, and the lockup at its foot below lg */
export default function HeroStop({ section: s, ref }: StopProps) {
  // the splash is still up: the kicker's rule waits for the handoff
  const pending = useAppStore((s) => s.intro);
  return (
    <Stop
      section={s}
      ref={ref}
      clear={false}
      // below lg the lockup is the hero's last child, set into the same
      // corner the chrome pins it to on desktop; lg and up the padding
      // clears the pinned one
      className="flex-col pt-[clamp(112px,17vh,180px)] pb-lockup-foot lg:pb-[clamp(150px,24vh,220px)]"
    >
      <StopWords
        stop="hero"
        kicker={s.kicker}
        kickerProps={{ className: "mb-[22px]", drawn: !pending }}
        heading={s.heading}
      />
      <HeroLockup at="foot" />
    </Stop>
  );
}
