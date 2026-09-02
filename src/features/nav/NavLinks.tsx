import { FOCUS_RING } from "@/theme/interact";
import type { NavItem } from "@/content/site";
import { cn } from "@/lib/utils";

export type NavLinksProps = {
  items: readonly NavItem[];
  /** the section under the viewport's midpoint; its link is marked current */
  activeId: string | null;
  /** a link was chosen; the caller scrolls */
  onNavigate?: (id: string) => void;
  className?: string;
};

/**
 * The desktop nav's row of section links. The current section's link takes
 * the seal colour and a hairline underline, and says so to assistive tech
 * with aria-current; on any other link the underline sweeps in from the
 * left under the pointer. Each link is a piece of the nav's cascade
 * (src/features/intro/navReveal.ts), and the row wears the glass that fades up with it.
 */
export default function NavLinks({
  items,
  activeId,
  onNavigate,
  className,
}: NavLinksProps) {
  return (
    <div
      data-nav-links=""
      data-nav-glass=""
      className={cn(
        "flex flex-wrap items-center gap-[clamp(12px,1.7vw,30px)] text-[11px] uppercase tracking-[0.22em] text-cream/70",
        className,
      )}
    >
      {items.map((n) => {
        const active = n.id === activeId;
        return (
          <a
            key={n.id}
            href={`#${n.id}`}
            data-nav-reveal=""
            aria-current={active ? "location" : undefined}
            onClick={(e) => {
              e.preventDefault();
              onNavigate?.(n.id);
            }}
            className={cn(
              "relative rounded-sm transition-colors duration-300 after:absolute after:inset-x-0 after:-bottom-1.5 after:h-px after:origin-left after:bg-seal after:transition-transform after:duration-500 after:ease-[cubic-bezier(0.16,1,0.3,1)] hover:after:scale-x-100",
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
