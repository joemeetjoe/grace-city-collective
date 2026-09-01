import { useContext } from "react";

import Reveal from "@/components/Reveal";
import { PanelShownContext } from "@/components/panel/Bracketed";

/** a copy panel's words: they rise in with the panel's brackets and go back out with them */
export default function PanelReveal(
  props: Omit<React.ComponentProps<typeof Reveal>, "shown">,
) {
  const shown = useContext(PanelShownContext);
  return <Reveal shown={shown} {...props} />;
}
