import type { ReactNode } from "react";

import { between, kicker } from "@/theme/classes";
import { DRAW_MS, KICKER_RULE_AT_MS } from "@/theme/motion";
import { usePanelShown } from "./Bracketed";

/**
 * A section's kicker with the hairline rule under it, both between the
 * canvases like the rest of a section's words. The rule draws out — from
 * the left, or from the middle when centred — when the panel around it is
 * shown, or as `drawn` says.
 */
export default function Kicker({
  children,
  className = "",
  centred = false,
  drawn,
}: {
  children: ReactNode;
  className?: string;
  centred?: boolean;
  /** when to draw the rule; by default, with the panel's brackets */
  drawn?: boolean;
}) {
  const shown = usePanelShown();
  const on = drawn ?? shown;
  return (
    <div
      className={`flex flex-col gap-3 ${centred ? "items-center" : ""} ${className}`}
    >
      <p className={`${between} text-balance ${kicker}`}>{children}</p>
      <hr
        aria-hidden
        data-kicker-rule=""
        data-drawn={on ? "true" : "false"}
        className={`${between} h-px w-12 border-0 bg-cream/30 motion-safe:transition-transform motion-safe:ease-site ${centred ? "origin-center" : "origin-left"} ${on ? "" : "motion-safe:scale-x-0"}`}
        style={{
          transitionDuration: `${DRAW_MS}ms`,
          transitionDelay: `${KICKER_RULE_AT_MS}ms`,
        }}
      />
    </div>
  );
}
