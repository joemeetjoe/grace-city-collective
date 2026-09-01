import type { SceneSection } from "@/content/site";
import AboutHousesStop from "./AboutHousesStop";
import GatheringsStop from "./GatheringsStop";
import GiveStop from "./GiveStop";
import HeroStop from "./HeroStop";
import VisitStop from "./VisitStop";

/** one viewport of the scene; the layout varies by stop, the words come from site.ts */
export default function Scene({ section }: { section: SceneSection }) {
  if (section.id === "hero") return <HeroStop section={section} />;
  if (section.id === "gatherings") return <GatheringsStop section={section} />;
  if (section.id === "visit") return <VisitStop section={section} />;
  if (section.id === "give") return <GiveStop section={section} />;
  // about and house churches share one component (and any id yet unknown
  // lands there, as it did in the one-Scene days)
  return <AboutHousesStop section={section} />;
}
