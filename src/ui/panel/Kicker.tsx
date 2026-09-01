import { useContext } from "react";

import { kickerCls } from "@/app/styles";
import { between, PanelShownContext } from "./Bracketed";

/** how long a kicker's rule takes to draw, in ms, and how long after its panel's brackets start */
const KICKER_RULE_MS = 900;
const KICKER_RULE_AT_MS = 300;

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
  children: React.ReactNode;
  className?: string;
  centred?: boolean;
  /** when to draw the rule; by default, with the panel's brackets */
  drawn?: boolean;
}) {
  const shown = useContext(PanelShownContext);
  const on = drawn ?? shown;
  return (
    <div
      className={`flex flex-col gap-3 ${centred ? "items-center" : ""} ${className}`}
    >
      <p className={`${between} text-balance ${kickerCls}`}>{children}</p>
      <hr
        aria-hidden
        data-kicker-rule=""
        data-drawn={on ? "true" : "false"}
        className={`${between} h-px w-12 border-0 bg-cream/30 motion-safe:transition-transform motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)] ${centred ? "origin-center" : "origin-left"} ${on ? "" : "motion-safe:scale-x-0"}`}
        style={{
          transitionDuration: `${KICKER_RULE_MS}ms`,
          transitionDelay: `${KICKER_RULE_AT_MS}ms`,
        }}
      />
    </div>
  );
}
