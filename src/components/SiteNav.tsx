import { jump, jumpTo } from "@/app/jump";
import { GHOST_BUTTON, SEAL_BUTTON } from "@/app/styles";
import { GLASS, GLASS_CORNERS } from "@/components/glass";
import GMark from "@/components/GMark";
import { FOCUS_RING } from "@/components/interact";
import { STACK } from "@/components/layerSplit";
import MobileNav from "@/components/MobileNav";
import NavLinks from "@/components/NavLinks";
import { useSite } from "@/content/useSite";

/**
 * The nav outlives the scene: fixed for the whole page, zero height so it
 * takes no room. Fixed, and outside the smoother's content — a transformed
 * ancestor would turn fixed into absolute. Over the scene the bar itself
 * carries no backdrop-filter at all (not even blur(0)): a backdrop-filter
 * makes the bar a backdrop root, and the links' frosted glass inside it
 * could then blur only the bar's own contents, never the scene
 */
export default function SiteNav({
  activeId,
  sceneInView,
}: {
  /** which section is under the viewport's midpoint, lighting its link */
  activeId: string | null;
  /** once the scene has scrolled away the nav sits over long-form text, so it
      takes an ink backdrop to stay legible */
  sceneInView: boolean;
}) {
  const site = useSite();
  return (
    <div
      className={`pointer-events-none fixed inset-x-0 top-0 ${STACK.nav} h-0`}
    >
      <nav
        className={`pointer-events-auto absolute inset-x-[clamp(9px,2.4vw,26px)] top-[clamp(9px,2.4vw,26px)] flex flex-wrap items-center justify-between gap-x-6 gap-y-3.5 rounded-[clamp(16px,2.4vw,26px)] px-[clamp(16px,3.4vw,34px)] py-[clamp(16px,2.6vw,26px)] transition-colors duration-500 ${
          sceneInView ? "" : "bg-ink/90 backdrop-blur-sm"
        }`}
      >
        {/* below xl: the seal mark and a Menu that opens the sheet. Nine links,
            the mark and both buttons need ~1240px for one row, so the full
            desktop nav waits for the xl breakpoint */}
        <MobileNav
          className="xl:hidden"
          activeId={activeId}
          onNavigate={jumpTo}
        />
        {/* from xl up, on the left: the two calls to action, stood in from
            the frame's rounded corner so they do not crowd the curve */}
        <div
          data-nav-actions=""
          className="hidden items-center gap-3 xl:ml-[clamp(24px,3.2vw,56px)] xl:flex"
        >
          <a
            href="#give"
            data-nav-reveal=""
            onClick={(e) => jump(e, "give")}
            className={`${GHOST_BUTTON} px-[22px] py-[11px] text-[11px] uppercase tracking-[0.18em]`}
          >
            Give
          </a>
          <a
            href="#visit"
            data-nav-reveal=""
            onClick={(e) => jump(e, "visit")}
            className={`${SEAL_BUTTON} px-6 py-3 text-[11px] font-bold uppercase tracking-[0.18em]`}
          >
            Join Sunday
          </a>
        </div>
        {/* from xl up, on the right: the section links, then the G mark at the corner */}
        <div className="hidden items-center gap-[clamp(14px,1.8vw,26px)] xl:flex">
          {/* the words alone take the glass; the mark beside them stays bare */}
          <NavLinks
            items={site.nav}
            activeId={activeId}
            onNavigate={jumpTo}
            className={`${GLASS} ${GLASS_CORNERS} px-[clamp(10px,1.2vw,18px)] py-2`}
          />
          <a
            href="#hero"
            data-nav-mark=""
            onClick={(e) => jump(e, "hero")}
            className={`inline-flex rounded-sm text-cream transition-opacity duration-300 hover:opacity-80 ${FOCUS_RING}`}
          >
            <GMark size={40} ruled />
          </a>
        </div>
      </nav>
    </div>
  );
}
