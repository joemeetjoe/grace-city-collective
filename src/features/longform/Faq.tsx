import { kicker, longformContainer, longformHeading, serif } from "@/theme/classes";
import SectionRule from "@/ui/panel/SectionRule";
import Reveal from "@/ui/Reveal";
import { useSite } from "@/content/useSite";
import { longform } from "./section";

export default function Faq() {
  const site = useSite();
  const faq = longform(site, "faq");
  return (
    <>
      <SectionRule />
      <div className={`${longformContainer} gap-10 md:flex-row md:gap-16`}>
        <Reveal as="header" className="flex flex-col gap-5 md:w-1/3">
          <p className={kicker}>{faq.kicker}</p>
          <h2
            className={longformHeading}
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
    </>
  );
}
