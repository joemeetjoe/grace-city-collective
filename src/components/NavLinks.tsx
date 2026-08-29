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
 * with aria-current.
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
            aria-current={active ? "location" : undefined}
            onClick={(e) => {
              e.preventDefault();
              onNavigate?.(n.id);
            }}
            className={cn(
              "relative transition-colors after:absolute after:inset-x-0 after:-bottom-1.5 after:h-px after:bg-seal after:opacity-0 after:transition-opacity hover:text-cream",
              active && "text-seal after:opacity-100 hover:text-seal",
            )}
          >
            {n.label}
          </a>
        );
      })}
    </div>
  );
}
