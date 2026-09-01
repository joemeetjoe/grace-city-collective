import type { SceneSection } from "@/content/site";
import HeroStop from "@/stops/HeroStop";
import LegacyStop from "@/stops/legacy";

/** one viewport of the scene; the layout varies by stop, the words come from site.ts */
export default function Scene({ section }: { section: SceneSection }) {
  if (section.id === "hero") return <HeroStop section={section} />;
  return <LegacyStop section={section} />;
}
