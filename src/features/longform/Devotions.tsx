import { kickerCls, serif } from "@/app/styles";
import SectionRule from "@/ui/panel/SectionRule";
import Reveal from "@/ui/Reveal";
import ScriptureRefs from "./ScriptureRefs";
import { useSite } from "@/content/useSite";
import { longform } from "./section";

export default function Devotions() {
  const site = useSite();
  const devotions = longform(site, "devotions");
  return (
    <>
      <SectionRule />
      <div className="mx-auto flex max-w-[1080px] flex-col gap-10">
        <Reveal
          as="header"
          className="flex max-w-[640px] flex-col gap-5"
        >
          <p className={kickerCls}>{devotions.kicker}</p>
          <h2
            className={`text-[clamp(34px,4.1vw,58px)] leading-[1.06] ${serif}`}
          >
            {devotions.heading}
          </h2>
          <p className="text-lg leading-relaxed text-pretty text-cream/75">
            {site.devotionsIntro}
          </p>
        </Reveal>
        {/* revealed per item, so the list comes in as it is reached however tall it runs */}
        <ol className="grid gap-x-10 gap-y-9 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
          {site.devotions.map((d, i) => (
            <Reveal
              as="li"
              key={d.title}
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
      </div>
    </>
  );
}
