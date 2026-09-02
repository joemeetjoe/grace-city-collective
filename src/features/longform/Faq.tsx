import { serif } from "@/theme/classes";
import Reveal from "@/ui/Reveal";
import { useSite } from "@/content/useSite";
import LongformSection from "./LongformSection";

export default function Faq() {
  const site = useSite();
  return (
    <LongformSection id="faq" className="gap-10 md:flex-row md:gap-16" headerClassName="flex flex-col gap-5 md:w-1/3">
      <dl className="flex flex-1 flex-col">
        {site.faq.map((q) => (
          <Reveal
            key={q.id}
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
    </LongformSection>
  );
}
