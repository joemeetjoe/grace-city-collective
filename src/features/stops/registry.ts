import type { ComponentType } from "react";

import type { SceneId } from "@/content/site";
import AboutStop from "./AboutStop";
import GatheringsStop from "./GatheringsStop";
import GiveStop from "./GiveStop";
import HeroStop from "./HeroStop";
import HouseChurchesStop from "./HouseChurchesStop";
import type { StopProps } from "./Stop";
import VisitStop from "./VisitStop";

/** a stop: one viewport of the scene, laid out its own way around the words site.ts gives it */
export type StopComponent = ComponentType<StopProps>;

/**
 * Which stop lays out which scene section (#121), keyed by the section id:
 * `satisfies` holds the table to every id in SceneId and no other, so a
 * section added to site.ts without a stop — or a stop for an id that is
 * not a section — fails to compile, where the old chain of ifs would have
 * rendered the about layout for anything it did not know.
 */
export const STOPS = {
  hero: HeroStop,
  about: AboutStop,
  "house-churches": HouseChurchesStop,
  gatherings: GatheringsStop,
  give: GiveStop,
  visit: VisitStop,
} satisfies Record<SceneId, StopComponent>;
