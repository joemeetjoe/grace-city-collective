import { STOPS } from "./registry";
import type { StopProps } from "./Stop";

/** one viewport of the scene: the stop the registry keeps for the section's id, with the section's words from site.ts */
export default function Scene({ section, ref }: StopProps) {
  const Stop = STOPS[section.id];
  return <Stop section={section} ref={ref} />;
}
