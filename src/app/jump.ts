import type { SectionId, SiteContent } from "@/content/site";
import { isLongformMounted, requestLongform } from "@/features/longform/longformRequest";
import { readScrollTop, type ScrollDriver } from "@/scroll/position";
import type { PageScroll } from "@/scroll/useSmoothScroll";

/**
 * The nav's jump to `#id`: the DOM primitive that scrolls to a section, and
 * the app's composition over it. A scene stop is on the page from the first
 * render and the jump goes at once; a long-form section's words come in
 * their own chunk, so the jump asks for it and lands once it has mounted —
 * its box is then its full height, not the placeholder's — unless it
 * already has. The app provides it to the nav (JumpProvider.tsx), and a
 * link's click reaches it through features/nav/useNavigate.ts. `immediate`
 * lands without the tween (a deep link on load, app/useHashSync.ts).
 */
type JumpOptions = {
  /** land at once, no tween: a deep link on load, where a glide would be a page arriving twice */
  immediate?: boolean;
  doc?: Document;
  win?: Window;
};

export type JumpTo = (id: SectionId, options?: Pick<JumpOptions, "immediate">) => void;

/**
 * Scroll to `#id`, easing through the smoother when there is one and
 * through the browser otherwise — or landing at once when `immediate`.
 * Honours the target's scroll-margin-top (the long-form headings keep clear
 * of the fixed nav). False when the id is not on the page.
 */
export function jumpTo(
  id: SectionId,
  driver: ScrollDriver | null,
  { immediate = false, doc = document, win = window }: JumpOptions = {},
): boolean {
  const el = doc.getElementById(id);
  if (!el) return false;
  // bounding rects follow the smoothed position, so this sum is document-relative either way
  const margin = parseFloat(win.getComputedStyle(el).scrollMarginTop) || 0;
  const top = el.getBoundingClientRect().top + readScrollTop(driver, doc) - margin;
  if (driver) driver.scrollTo(top, !immediate);
  else win.scrollTo({ top, behavior: immediate ? "instant" : "smooth" });
  return true;
}

/** the nav's jump over `site`, through `scroll`'s driver: which ids wait for the long-form chunk (#111) */
export function createJump(site: SiteContent, scroll: Pick<PageScroll, "driver">): JumpTo {
  const longformIds = new Set<SectionId>(site.longform.map((s) => s.id));
  return (id, options) => {
    if (longformIds.has(id) && !isLongformMounted()) {
      void requestLongform().then(() => jumpTo(id, scroll.driver(), options));
      return;
    }
    // through the smoother when one is running, native smooth scroll otherwise
    jumpTo(id, scroll.driver(), options);
  };
}
