import { kickerCls, serif } from "@/app/styles";
import SectionRule from "@/ui/panel/SectionRule";
import Reveal from "@/ui/Reveal";
import ScriptureRefs from "./ScriptureRefs";
import { useSite } from "@/content/useSite";
import { LONGFORM_SECTION, longform } from "@/longform/section";

export default function Beliefs() {
  const site = useSite();
  const beliefs = longform(site, "beliefs");
  return (
    <section id={beliefs.id} className={LONGFORM_SECTION}>
      <SectionRule />
      <div className="mx-auto flex max-w-[1080px] flex-col gap-12">
        <Reveal
          as="header"
          className="flex max-w-[720px] flex-col gap-5"
        >
          <p className={kickerCls}>{beliefs.kicker}</p>
          <h2
            className={`text-[clamp(34px,4.1vw,58px)] leading-[1.06] ${serif}`}
          >
            {beliefs.heading}
          </h2>
        </Reveal>
        <ul className="grid gap-8 md:grid-cols-3">
          {site.beliefPosture.map((p) => (
            <Reveal
              as="li"
              key={p.ref}
              className="rule-draw flex flex-col gap-3 pt-5"
            >
              <p className={`text-[22px] leading-snug ${serif}`}>
                {p.line}
              </p>
              <p className="text-sm leading-relaxed text-cream/60">
                “{p.quote}”
              </p>
              <p className="text-xs uppercase tracking-[0.16em] text-seal">
                {p.ref}
              </p>
            </Reveal>
          ))}
        </ul>
        <dl className="grid gap-x-10 gap-y-10 md:grid-cols-2">
          {site.beliefs.map((b) => (
            <Reveal key={b.title} className="flex flex-col gap-3">
              <dt className={`text-[28px] leading-[1.12] ${serif}`}>
                {b.title}
              </dt>
              <dd className="text-base leading-relaxed text-cream/70">
                {b.body}
              </dd>
              <dd className="text-xs uppercase tracking-[0.16em] text-seal">
                <ScriptureRefs refs={b.refs} />
              </dd>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  );
}
