import { kickerCls, serif } from "@/app/styles";
import SectionRule from "@/components/panel/SectionRule";
import Reveal from "@/components/Reveal";
import { useSite } from "@/content/useSite";
import { LONGFORM_SECTION, longform } from "@/longform/section";

export default function Faq() {
  const site = useSite();
  const faq = longform(site, "faq");
  return (
    <section id={faq.id} className={LONGFORM_SECTION}>
      <SectionRule />
      <div className="mx-auto flex max-w-[1080px] flex-col gap-10 md:flex-row md:gap-16">
        <Reveal as="header" className="flex flex-col gap-5 md:w-1/3">
          <p className={kickerCls}>{faq.kicker}</p>
          <h2
            className={`text-[clamp(34px,4.1vw,58px)] leading-[1.06] ${serif}`}
          >
            {faq.heading}
          </h2>
        </Reveal>
        <dl className="flex flex-1 flex-col">
          {site.faq.map((q) => (
            <Reveal
              key={q.question}
              className="rule-draw flex flex-col gap-3 py-6"
            >
              <dt className={`text-[26px] leading-[1.15] ${serif}`}>
                {q.question}
              </dt>
              <dd className="text-base leading-relaxed text-cream/70">
                {q.answer}
              </dd>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  );
}
