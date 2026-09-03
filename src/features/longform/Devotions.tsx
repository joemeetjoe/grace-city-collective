import { serif } from "@/theme/classes";
import Reveal from "@/ui/Reveal";
import ScriptureRefs from "./ScriptureRefs";
import { useSite } from "@/content/useSite";
import LongformSection from "./LongformSection";

export default function Devotions() {
  const site = useSite();
  return (
    <LongformSection id="devotions" className="gap-10" headerClassName="flex max-w-[640px] flex-col gap-5">
      {/* revealed per item, so the list comes in as it is reached however tall it runs */}
      <ol className="grid gap-x-10 gap-y-9 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
        {site.devotions.map((d, i) => (
          <Reveal
            as="li"
            key={d.id}
            className="rule-draw flex flex-col gap-3 pt-5"
          >
            <p className="text-xs uppercase tracking-[0.16em] text-seal">
              {String(i + 1).padStart(2, "0")} ·{" "}
              <ScriptureRefs refs={d.refs} />
            </p>
            <h3 className={`text-[28px] leading-[1.12] ${serif}`}>
              {d.title}
            </h3>
            <p className="text-base leading-relaxed text-cream/70">
              {d.body}
            </p>
          </Reveal>
        ))}
      </ol>
    </LongformSection>
  );
}
