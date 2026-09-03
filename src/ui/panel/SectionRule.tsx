import OrnateRule from "@/ui/OrnateRule";
import { useInViewOnce } from "@/ui/useInViewOnce";

/** the ornamented rule that opens each long-form section, centred, in the seal's red */
const SEPARATOR =
  "mx-auto mb-[clamp(40px,6vh,72px)] w-[clamp(160px,24vw,320px)] text-seal";

/** how much of a long-form section's opening rule must be on screen before it draws */
const RULE_DRAW_THRESHOLD = 0.5;

/** the ornamented rule that opens a long-form section, drawn the first time it is seen */
export default function SectionRule() {
  const [ref, drawn] = useInViewOnce<HTMLSpanElement>(RULE_DRAW_THRESHOLD);
  return <OrnateRule ref={ref} drawn={drawn} className={SEPARATOR} />;
}
