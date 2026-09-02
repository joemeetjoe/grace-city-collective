import { FOCUS_RING, NAV_GLASS, NAV_REVEAL } from "@/theme/classes";
import { useSite } from "@/content/useSite";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/state/appStore";
import { revealRef } from "@/state/revealTargets";
import { useNavigate } from "./useNavigate";

export type NavLinksProps = {
  className?: string;
};

/**
 * The desktop nav's row of section links. The current section's link takes
 * the seal colour and a hairline underline, and says so to assistive tech
 * with aria-current; on any other link the underline sweeps in from the
 * left under the pointer. Each link is a piece of the nav's cascade
 * (src/features/intro/navReveal.ts), and the row wears the glass that fades up with it.
 */
export default function NavLinks({ className }: NavLinksProps) {
  const site = useSite();
  const activeId = useAppStore((s) => s.activeId);
  const navigate = useNavigate();
  return (
    <div
      ref={revealRef("glass")}
      className={cn(
        NAV_GLASS,
        "flex flex-wrap items-center gap-[clamp(12px,1.7vw,30px)] text-[11px] uppercase tracking-[0.22em] text-cream/70",
        className,
      )}
    >
      {site.nav.map((n) => {
        const active = n.id === activeId;
        return (
          <a
            key={n.id}
            ref={revealRef("link")}
            href={`#${n.id}`}
            aria-current={active ? "location" : undefined}
            onClick={navigate(n.id)}
            className={cn(
              NAV_REVEAL,
              "relative rounded-sm transition-colors duration-300 after:absolute after:inset-x-0 after:-bottom-1.5 after:h-px after:origin-left after:bg-seal after:transition-transform after:duration-500 after:ease-site hover:after:scale-x-100",
              FOCUS_RING,
              active ? "text-seal after:scale-x-100 hover:text-seal" : "after:scale-x-0 hover:text-cream",
            )}
          >
            {n.label}
          </a>
        );
      })}
    </div>
  );
}
