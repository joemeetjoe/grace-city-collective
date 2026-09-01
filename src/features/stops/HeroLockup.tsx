import { STACK } from "@/theme/layerSplit";
import Lockup from "@/marks/Lockup";
import { useBelowLg } from "@/layout/breakpoint";

/**
 * The hero's lockup, rendered once: from lg up pinned in the sticky chrome's
 * bottom-left corner over every stop; below lg at the hero's foot, where it
 * stacks (Lockup.tsx) and scrolls away with the hero — from the second stop
 * on the G in the nav corner carries the identity (#53). Above the front
 * canvas either way, so the nearest figures never cover it.
 */
export default function HeroLockup({ at }: { at: "chrome" | "foot" }) {
  const belowLg = useBelowLg();
  if (belowLg !== (at === "foot")) return null;
  return (
    <div
      data-hero-lockup=""
      className={
        at === "chrome"
          ? "absolute bottom-[clamp(22px,4.2vw,52px)] left-[clamp(20px,4.4vw,60px)] right-[clamp(20px,4.4vw,60px)] flex justify-start"
          : `relative ${STACK.copy} mt-auto flex justify-start`
      }
    >
      <Lockup />
    </div>
  );
}
