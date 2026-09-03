import type { ComponentType } from "react";

import type { LongformId } from "@/content/site";
import Beliefs from "./Beliefs";
import Devotions from "./Devotions";
import Faq from "./Faq";
import Messages from "./Messages";
import SiteFooter from "./SiteFooter";

/** what the chunk renders in one place: a section's words by its id, or the footer */
export type LongformPart = LongformId | "footer";

const bodies: Record<LongformId, ComponentType> = {
  devotions: Devotions,
  beliefs: Beliefs,
  faq: Faq,
  messages: Messages,
};

/**
 * The long-form chunk's one component (loadLongform.ts): the words of each
 * section and the footer. The section elements themselves stay in the shell
 * (LongformGate.tsx) so their ids, boxes and ScrollTriggers never change
 * hands; this fills them in once the chunk has arrived.
 */
export default function Longform({ part }: { part: LongformPart }) {
  if (part === "footer") return <SiteFooter />;
  const Body = bodies[part];
  return <Body />;
}
