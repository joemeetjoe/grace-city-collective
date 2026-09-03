import type { ComponentProps } from "react";

import Reveal from "@/ui/Reveal";
import { usePanelShown } from "./usePanelShown";

/** a copy panel's words: they rise in with the panel's brackets and go back out with them */
export default function PanelReveal(
  props: Omit<ComponentProps<typeof Reveal>, "shown">,
) {
  const shown = usePanelShown();
  return <Reveal shown={shown} {...props} />;
}
