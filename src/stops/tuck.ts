import { gutter } from "@/app/styles";
// one definition of the between-canvases step, kept with the panel that wears it
import { between } from "@/ui/panel/Bracketed";

export { between };

// a scene card's paragraphs below lg: the phone headline is ~30px to the
// desktop's ~48px, so 16px Geist (a big x-height, uniform strokes) out-weighs
// the hairline Cormorant beside it; a half-size down, more leading and a
// hair lighter on the variable axis restores the desktop's hierarchy
export const PHONE_BODY = "max-lg:text-[14.5px] max-lg:leading-[1.6] max-lg:font-[380]";

/**
 * Where each stop's panel tucks behind the nearest figures (the front cuts
 * of layerSplit.ts): extra padding on that side, so the glass runs on under
 * the figure while the words stop short of it. Who crosses what, at rest:
 * who we are — the panel steps in from the gutter and the two near apostles
 * on the left stand over its right third; house churches — the right-hand apostle's head over the
 * bottom edge; gatherings — the two left apostles' heads over the lower-left
 * corner, the right-hand one over the lower-right (the space that clears
 * them is the calendar's column, its divider running under the heads); give — a hood over the
 * left edge, so the panel steps right and pads both sides to keep its words
 * centred (the left band holds the sown field, GiveSowing). Where a figure lands depends on both viewport axes — the
 * waypoints (PentecostParallax) fill the frame's height, and the lateral
 * budget clamps the frame's centre by its aspect — so the who-we-are and
 * gatherings tucks are linear fits in vw and vh to the figures' screen
 * positions measured at six sizes from 1280×720 to 2560×1440 (residuals
 * under 20px); who-we-are steps in from the gutter from 1440 up, and its
 * tuck is set per width range — the ranges are mutually exclusive because
 * Tailwind orders an arbitrary min-[] variant before lg, so a plain
 * min-[1440px]:[--tuck:…] would lose to lg:[--tuck:…]. Both tucks are a
 * --tuck variable rather than padding: the column each clears holds the
 * panel's ornament (GatheringsCalendar, AboutSharedLife). A tucked panel is taller than it was, so those two sit up
 * from the top of the frame rather than centred, clear of the lockup; on a
 * short viewport (≤ 820px) the who-we-are and give type steps down a size
 * as well. Give's paragraphs also set narrower on smaller desktops, so the
 * words fit between the hood on the left and the apostle on the right.
 * On a phone every panel spans the frame and the left apostles stay back
 * (layerSplit.ts), so nothing reaches a panel at rest there; the panels
 * only rise from behind the figures on the way in.
 */
export const TUCK: Partial<Record<string, string>> = {
  about:
    "lg:self-start lg:mt-[clamp(96px,12vh,140px)] lg:pl-[clamp(18px,2.6vw,32px)] lg:max-[1439px]:[--tuck:clamp(32px,calc(588px_-_22.7vw_+_4.8vh),320px)] min-[1440px]:ml-[clamp(24px,1.9vw,48px)] min-[1440px]:max-[1799px]:[--tuck:clamp(32px,calc(585px_-_20.8vw_+_4.8vh),340px)] min-[1800px]:[--tuck:clamp(32px,calc(505px_-_20.8vw_+_4.8vh),340px)]",
  gatherings:
    "lg:self-start lg:mt-[clamp(96px,12vh,140px)] lg:[--tuck:clamp(120px,calc(58.8vw_-_63.6vh_-_60px),420px)] lg:pb-[clamp(40px,calc(30vh_-_200px),120px)] 2xl:max-w-[1200px]",
  give: "lg:translate-x-[clamp(120px,9.4vw,160px)] lg:px-[clamp(120px,9.4vw,160px)]",
};

/**
 * A stop's section frame. No z-index: a section must not form a stacking
 * context, or its headline could never sit under the front canvas while its
 * copy sits over it.
 * On desktop a section is one viewport: one camera waypoint each, turned
 * like pages. Below lg the scene scrolls natively (#52) and a section is as
 * tall as its words; only the hero keeps the whole first frame, so the
 * lockup at its foot stands alone before the next section's words arrive
 * the hero and the visit stop keep a full viewport at every width: the first
 * frame must not show the next stop, and the scene's sticky canvas leaves with
 * the last section, so a short last section would take the dove away before
 * the reader reached it
 * a held section is lvh, the tallest the viewport ever gets on a phone: at
 * svh the next stop's card sits inside the first frame the moment the URL
 * bar retracts. The unheld sections keep svh — that is only a floor on a
 * desktop viewport, where the three are the same number
 */
export function stopFrame(id: string) {
  const holds = id === "hero" || id === "visit";
  const base = `relative flex ${holds ? "min-h-[100lvh]" : "lg:min-h-[100svh]"} ${gutter} max-lg:px-8`;
  // below lg the seal row sits over the top of every section and the lockup
  // over its foot; desktop keeps its unpadded frames
  const clear = "pt-[clamp(88px,11vh,110px)] pb-[clamp(72px,9vh,96px)] lg:py-0";
  return { base, clear };
}
