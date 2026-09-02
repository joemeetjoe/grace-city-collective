import GMark from "@/marks/GMark";
import { GLASS, GLASS_CORNERS, NAV_REVEAL, STACK, button, navMark } from "@/theme/classes";
import { NAV_MARK_SIZE } from "@/theme/measures";
import MobileNav from "./MobileNav";
import { HOME_LABEL } from "./mobileNavLabels";
import NavLinks from "./NavLinks";
import { useNavigate } from "./useNavigate";
import { useAppStore } from "@/state/appStore";
import { revealRef } from "@/state/revealTargets";

/**
 * The nav outlives the scene: fixed for the whole page, zero height so it
 * takes no room. Fixed, and outside the smoother's content — a transformed
 * ancestor would turn fixed into absolute. Over the scene the bar itself
 * carries no backdrop-filter at all (not even blur(0)): a backdrop-filter
 * makes the bar a backdrop root, and the links' frosted glass inside it
 * could then blur only the bar's own contents, never the scene. Once the
 * scene has scrolled away (the store's `sceneInView`) the nav sits over
 * long-form text, so it takes an ink backdrop to stay legible.
 */
export default function SiteNav() {
  const sceneInView = useAppStore((s) => s.sceneInView);
  const navigate = useNavigate();
  return (
    <div
      className={`pointer-events-none fixed inset-x-0 top-0 ${STACK.nav} h-0`}
    >
      <nav
        aria-label="Primary"
        className={`pointer-events-auto absolute inset-x-frame-inset top-frame-inset flex flex-wrap items-center justify-between gap-x-6 gap-y-3.5 rounded-[clamp(16px,2.4vw,26px)] px-[clamp(16px,3.4vw,34px)] py-[clamp(16px,2.6vw,26px)] motion-safe:transition-colors duration-500 ${
          sceneInView ? "" : "bg-ink/90 backdrop-blur-sm"
        }`}
      >
        {/* below xl: the seal mark and a Menu that opens the sheet. Nine links,
            the mark and both buttons need ~1240px for one row, so the full
            desktop nav waits for the xl breakpoint */}
        <MobileNav className="xl:hidden" />
        {/* from xl up, on the left: the two calls to action, stood in from
            the frame's rounded corner so they do not crowd the curve */}
        <div className="hidden items-center gap-3 xl:ml-[clamp(24px,3.2vw,56px)] xl:flex">
          <a
            ref={revealRef("action")}
            href="#give"
            onClick={navigate("give")}
            className={`${NAV_REVEAL} ${button({ intent: "ghost", size: "navHollow" })}`}
          >
            Give
          </a>
          <a
            ref={revealRef("action")}
            href="#visit"
            onClick={navigate("visit")}
            className={`${NAV_REVEAL} ${button({ intent: "seal", size: "nav" })}`}
          >
            Join Sunday
          </a>
        </div>
        {/* from xl up, on the right: the section links, then the G mark at the corner —
            a link named Home (#130): the mark inside is decoration to it */}
        <div className="hidden items-center gap-[clamp(14px,1.8vw,26px)] xl:flex">
          {/* the words alone take the glass; the mark beside them stays bare */}
          <NavLinks className={`${GLASS} ${GLASS_CORNERS} px-[clamp(10px,1.2vw,18px)] py-2`} />
          <a
            ref={revealRef("mark")}
            href="#hero"
            onClick={navigate("hero")}
            aria-label={HOME_LABEL}
            className={navMark({ seat: "corner" })}
          >
            <GMark size={NAV_MARK_SIZE} ruled decorative />
          </a>
        </div>
      </nav>
    </div>
  );
}
