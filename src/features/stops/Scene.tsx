import type { Ref } from "react";

import type { SceneSection } from "@/content/site";
import AboutHousesStop from "./AboutHousesStop";
import GatheringsStop from "./GatheringsStop";
import GiveStop from "./GiveStop";
import HeroStop from "./HeroStop";
import VisitStop from "./VisitStop";

/** a stop's props: its words from site.ts, and the ref its <section> lands in (scroll/sectionRefs.ts) */
export type StopProps = { section: SceneSection; ref?: Ref<HTMLElement> };

/** one viewport of the scene; the layout varies by stop, the words come from site.ts */
export default function Scene({ section, ref }: StopProps) {
  if (section.id === "hero") return <HeroStop section={section} ref={ref} />;
  if (section.id === "gatherings") return <GatheringsStop section={section} ref={ref} />;
  if (section.id === "visit") return <VisitStop section={section} ref={ref} />;
  if (section.id === "give") return <GiveStop section={section} ref={ref} />;
  // about and house churches share one component (and any id yet unknown
  // lands there, as it did in the one-Scene days)
  return <AboutHousesStop section={section} ref={ref} />;
}
