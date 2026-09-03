import { FOCUS_RING, LINK_SWEEP, serif } from "@/theme/classes";
import Reveal from "@/ui/Reveal";
import { useSite } from "@/content/useSite";
import LongformSection from "./LongformSection";

export default function Messages() {
  const site = useSite();
  const { messages } = site;
  return (
    <LongformSection
      id="messages"
      className="gap-10"
      heading={
        <>
          <span className="block text-[11px] uppercase tracking-[0.28em] text-cream/50 font-sans mb-3">
            {messages.seriesLabel}
          </span>
          {messages.series}
        </>
      }
    >
      <ol className="grid gap-x-10 gap-y-8 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
        {messages.latest.map((m) => (
          <Reveal
            as="li"
            key={m.id}
            className="rule-draw flex flex-col gap-3 pt-5"
          >
            <p className="text-xs uppercase tracking-[0.16em] text-seal">
              {m.date} · {m.passage}
            </p>
            <h3 className={`text-[26px] leading-[1.15] ${serif}`}>
              <a
                href={m.href}
                className={`${LINK_SWEEP} ${FOCUS_RING} rounded-sm hover:text-cream/80`}
              >
                {m.title}
              </a>
            </h3>
            <p className="text-sm text-cream/60">{m.speaker}</p>
          </Reveal>
        ))}
      </ol>
      <Reveal className="flex">
        <p className="text-[11px] uppercase tracking-[0.22em]">
          <a
            href={messages.all.href}
            className={`${LINK_SWEEP} ${FOCUS_RING} rounded-sm text-cream/70 hover:text-cream`}
          >
            {messages.all.label}
          </a>
        </p>
      </Reveal>
    </LongformSection>
  );
}
