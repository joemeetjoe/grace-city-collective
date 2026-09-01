import type { SceneSection } from "@/content/site";
import GatheringsStop from "@/stops/GatheringsStop";
import GiveStop from "@/stops/GiveStop";
import HeroStop from "@/stops/HeroStop";
import LegacyStop from "@/stops/legacy";
import VisitStop from "@/stops/VisitStop";

/** one viewport of the scene; the layout varies by stop, the words come from site.ts */
export default function Scene({ section }: { section: SceneSection }) {
  if (section.id === "hero") return <HeroStop section={section} />;
  if (section.id === "gatherings") return <GatheringsStop section={section} />;
  if (section.id === "visit") return <VisitStop section={section} />;
  if (section.id === "give") return <GiveStop section={section} />;
  return <LegacyStop section={section} />;
}
