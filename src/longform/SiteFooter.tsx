import { gutter, serif } from "@/app/styles";
import { FOCUS_RING, LINK_SWEEP } from "@/theme/interact";
import Reveal, { REVEAL_STAGGER_MS } from "@/components/Reveal";
import { useSite } from "@/content/useSite";

export default function SiteFooter() {
  const site = useSite();
  const { contact } = site;
  return (
    <footer
      className={`${gutter} border-t border-cream/15 py-[clamp(48px,8vh,80px)]`}
    >
      <Reveal
        stagger={REVEAL_STAGGER_MS * 2}
        className="mx-auto grid max-w-[1080px] gap-10 text-sm text-cream/70 md:grid-cols-3"
      >
        <div className="flex flex-col gap-2">
          <p className={`text-[22px] text-cream ${serif}`}>
            {site.name}
          </p>
          <p>
            {contact.address.street} {contact.address.suite}
            <br />
            {contact.address.city}
          </p>
          <p>Sunday Worship Gathering · {contact.sunday}</p>
        </div>
        <div className="flex flex-col gap-2">
          <a
            href={`mailto:${contact.email}`}
            className={`${LINK_SWEEP} ${FOCUS_RING} self-start rounded-sm hover:text-cream`}
          >
            {contact.email}
          </a>
          <p>{contact.pastor.name}, pastor</p>
          <a
            href={`mailto:${contact.pastor.email}`}
            className={`${LINK_SWEEP} ${FOCUS_RING} self-start rounded-sm hover:text-cream`}
          >
            {contact.pastor.email}
          </a>
        </div>
        <div className="flex flex-col gap-2 md:items-end">
          <p className="flex flex-wrap gap-x-4 gap-y-2 text-[11px] uppercase tracking-[0.22em]">
            <span className="text-cream/45">{site.footer.follow}</span>
            {site.socials.map((s) => (
              <a
                key={s.href}
                href={s.href}
                className={`${LINK_SWEEP} ${FOCUS_RING} rounded-sm hover:text-cream`}
              >
                {s.label}
              </a>
            ))}
          </p>
          <p className="text-xs text-cream/45">
            © {site.footer.copyright}
          </p>
        </div>
      </Reveal>
    </footer>
  );
}
