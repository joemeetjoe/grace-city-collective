import Reveal from "@/ui/Reveal";
import { usePanelShown } from "./Bracketed";

/** a copy panel's words: they rise in with the panel's brackets and go back out with them */
export default function PanelReveal(
  props: Omit<React.ComponentProps<typeof Reveal>, "shown">,
) {
  const shown = usePanelShown();
  return <Reveal shown={shown} {...props} />;
}
