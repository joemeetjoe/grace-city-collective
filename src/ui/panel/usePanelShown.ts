import { useContext } from "react";

import { PanelShownContext } from "./panelShown";

/**
 * Whether the copy panel around a component is shown (#121): what a kicker,
 * a reveal or an ornament inside a panel asks, to come in with its brackets.
 * A stop itself stands outside its panel and has the answer already
 * (useStopPanel); this is for what renders within.
 */
export function usePanelShown(): boolean {
  return useContext(PanelShownContext);
}
