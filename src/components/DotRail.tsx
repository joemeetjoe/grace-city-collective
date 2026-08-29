import { GLASS } from "@/components/glass";
import { cn } from "@/lib/utils";
import type { SectionMarker } from "@/scroll/markers";

export type DotRailProps = {
  /** every section in page order, from sectionMarkers(site) */
  markers: readonly SectionMarker[];
  /** the section under the viewport's midpoint; its dot is filled */
  activeId: string | null;
  /** a dot was chosen; the caller scrolls */
  onNavigate?: (id: string) => void;
  className?: string;
};

/**
 * A slim rail of dots down the right edge, one per section, the current one
 * filled crimson. Each dot is a link named after its section; the name is
 * written out beside the dot and revealed on hover or focus. Fixed, and kept
 * outside the smoother's content like the nav (a transformed ancestor would
 * pin it to the page). Hidden below the tablet breakpoint, where it would
 * compete with thumbs.
 */
export default function DotRail({
  markers,
  activeId,
  onNavigate,
  className,
}: DotRailProps) {
  return (
    <nav
      aria-label="Sections"
      data-dot-rail=""
      className={cn(
        "fixed top-1/2 right-[clamp(18px,3vw,40px)] z-30 hidden -translate-y-1/2 flex-col items-end gap-1.5 lg:flex",
        className,
      )}
    >
      {/* the nav's glass, behind the column of dots only: the labels beside
          them are laid out but hidden, so the strip hugs the dots. The mark's
          corners, at the strip's own scale */}
      <span
        aria-hidden
        data-dot-glass=""
        className={cn(
          "absolute -inset-y-2.5 -right-[7px] -z-10 w-7 rounded-tl-[12px] rounded-br-[12px]",
          GLASS,
        )}
      />
      {markers.map((m) => {
        const active = m.id === activeId;
        return (
          <a
            key={m.id}
            href={`#${m.id}`}
            aria-label={m.label}
            aria-current={active ? "location" : undefined}
            onClick={(e) => {
              e.preventDefault();
              onNavigate?.(m.id);
            }}
            className="group flex items-center gap-3 rounded-full p-1 outline-none focus-visible:ring-1 focus-visible:ring-cream/60"
          >
            <span
              aria-hidden
              data-dot-label=""
              className={cn(
                "text-[10px] uppercase tracking-[0.22em] whitespace-nowrap text-cream/80 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 motion-safe:transition-opacity motion-safe:duration-200",
                active && "text-seal",
              )}
            >
              {m.label}
            </span>
            <span
              aria-hidden
              data-dot=""
              className={cn(
                "block size-1.5 rounded-full border border-cream/55 transition-colors group-hover:border-cream",
                active && "border-seal bg-seal group-hover:border-seal",
              )}
            />
          </a>
        );
      })}
    </nav>
  );
}
