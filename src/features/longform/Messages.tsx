import { kickerCls, serif } from "@/app/styles";
import { FOCUS_RING, LINK_SWEEP } from "@/theme/interact";
import SectionRule from "@/ui/panel/SectionRule";
import Reveal from "@/ui/Reveal";
import { useSite } from "@/content/useSite";
import { longform } from "./section";

export default function Messages() {
  const site = useSite();
  const messages = longform(site, "messages");
  return (
    <>
      <SectionRule />
      <div className="mx-auto flex max-w-[1080px] flex-col gap-10">
        <Reveal as="header" className="flex flex-col gap-5">
          <p className={kickerCls}>{messages.kicker}</p>
          <h2
            className={`text-[clamp(34px,4.1vw,58px)] leading-[1.06] ${serif}`}
          >
            <span className="block text-[11px] uppercase tracking-[0.28em] text-cream/50 font-sans mb-3">
              Current series
            </span>
            {site.messages.series}
          </h2>
        </Reveal>
        <ol className="grid gap-x-10 gap-y-8 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
          {site.messages.latest.map((m) => (
            <Reveal
              as="li"
              key={m.href}
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
              href={site.messages.all.href}
              className={`${LINK_SWEEP} ${FOCUS_RING} rounded-sm text-cream/70 hover:text-cream`}
            >
              {site.messages.all.label}
            </a>
          </p>
        </Reveal>
      </div>
    </>
  );
}
