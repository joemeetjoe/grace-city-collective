/**
 * The site for readers that do not run JavaScript: crawlers, share cards and
 * assistants. Everything here is a pure function of the site content
 * (site.ts) — the head tags, robots.txt, sitemap.xml, the JSON-LD graph,
 * llms.txt, llms-full.txt and the noscript block are generated from the one
 * object at build, so none of them can drift from the page.
 *
 * DOM-free, with relative imports: vite.config.ts (built under the node
 * tsconfig) injects the tags and emits the files (the gcc:surfaces plugin).
 * Strings in, strings out.
 */
import type { SiteContent } from "./site";
import { tokens } from "../theme/tokens";

/** where the site is served from: the deployment origin and Vite's base path */
export type SurfaceOptions = {
  /** `https://gracecitycollective.com` — SITE_ORIGIN at build */
  origin: string;
  /** Vite's `base`: `/`, or `/repo/` under a project page */
  base: string;
};

/** what vite's transformIndexHtml accepts (its HtmlTagDescriptor, without the import) */
export type SurfaceTag = {
  tag: string;
  attrs?: Record<string, string>;
  children?: string;
  injectTo: "head" | "body";
};

/** the share card: public/share.jpg, cut by tools/share/share-image.py */
export const SHARE_IMAGE = { file: "share.jpg", width: 1200, height: 630 } as const;

/** the site's one URL, with a trailing slash: origin + base */
export function siteUrl({ origin, base }: SurfaceOptions): string {
  return new URL(base, origin).href;
}

/** a file at the site root, absolute */
export function siteFile(opts: SurfaceOptions, file: string): string {
  return new URL(file, siteUrl(opts)).href;
}

const scene = (site: SiteContent, id: string) => site.scene.find((s) => s.id === id);

/** the hero's kicker, "A house church collective · West Georgia", as a phrase: "a house church collective in West Georgia" */
function whatAndWhere(site: SiteContent): string {
  const kicker = scene(site, "hero")?.kicker ?? site.name;
  const [what, where] = kicker.split(" · ");
  return where ? `${what.charAt(0).toLowerCase()}${what.slice(1)} in ${where}` : what;
}

/**
 * The one-line description, for the meta tag, the share card and the Church
 * in the JSON-LD: the hero's headline, then what and where the collective is
 * and when it meets, from the hero kicker and the house churches.
 */
export function description(site: SiteContent): string {
  const hero = scene(site, "hero")?.heading ?? site.name;
  const homes = site.gatherings[0];
  const when = homes ? `: ${homes.when.split(" · ").slice(0, 2).join(", ").replace(/^Every/, "every")}` : "";
  return sentence(`${hero} ${site.name} is ${whatAndWhere(site)}${when}`);
}

/** the share card's title: the collective, then its headline */
export function shareTitle(site: SiteContent): string {
  const hero = scene(site, "hero")?.heading;
  return hero ? `${site.name} — ${hero}` : site.name;
}

/** ends in a full stop, without doubling one already there ("10:30 a.m.") */
const sentence = (text: string): string => (text.endsWith(".") ? text : `${text}.`);

const meta = (attrs: Record<string, string>): SurfaceTag => ({ tag: "meta", attrs, injectTo: "head" });

/**
 * The head: description, canonical, Open Graph and Twitter cards with the
 * share image, theme-color in ink. The <title> stays in index.html.
 */
export function headTags(site: SiteContent, opts: SurfaceOptions): SurfaceTag[] {
  const url = siteUrl(opts);
  const image = siteFile(opts, SHARE_IMAGE.file);
  const desc = description(site);
  const title = shareTitle(site);
  return [
    meta({ name: "description", content: desc }),
    { tag: "link", attrs: { rel: "canonical", href: url }, injectTo: "head" },
    meta({ property: "og:type", content: "website" }),
    meta({ property: "og:site_name", content: site.name }),
    meta({ property: "og:title", content: title }),
    meta({ property: "og:description", content: desc }),
    meta({ property: "og:url", content: url }),
    meta({ property: "og:image", content: image }),
    meta({ property: "og:image:width", content: String(SHARE_IMAGE.width) }),
    meta({ property: "og:image:height", content: String(SHARE_IMAGE.height) }),
    meta({ property: "og:image:alt", content: site.name }),
    meta({ name: "twitter:card", content: "summary_large_image" }),
    meta({ name: "twitter:title", content: title }),
    meta({ name: "twitter:description", content: desc }),
    meta({ name: "twitter:image", content: image }),
    meta({ name: "theme-color", content: tokens.ink }),
  ];
}

/** the sitemap's file name at the site root */
export const SITEMAP_FILE = "sitemap.xml";

/**
 * robots.txt: every crawler may read everything — search engines and the
 * AI crawlers alike (GPTBot, ClaudeBot, PerplexityBot, Google-Extended get
 * no carve-out) — and the sitemap is named by absolute URL.
 */
export function robotsTxt(opts: SurfaceOptions): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${siteFile(opts, SITEMAP_FILE)}\n`;
}

/** a one-URL sitemap: the site is a single page */
export function sitemapXml(opts: SurfaceOptions): string {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    `  <url><loc>${escapeXml(siteUrl(opts))}</loc></url>\n` +
    "</urlset>\n"
  );
}

/** `&`, `<`, `>` and the quotes as entities, for XML and HTML text and attributes alike */
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---- JSON-LD -------------------------------------------------------------

export type PostalAddress = {
  "@type": "PostalAddress";
  streetAddress: string;
  addressLocality?: string;
  addressRegion?: string;
  postalCode?: string;
};
export type Place = { "@type": "Place"; name: string; address: PostalAddress };
export type Schedule = {
  "@type": "Schedule";
  byDay?: string;
  byMonthWeek?: number;
  repeatFrequency?: string;
  startTime?: string;
};
export type ChurchNode = {
  "@type": "Church";
  "@id": string;
  name: string;
  alternateName?: string;
  url: string;
  description: string;
  image: string;
  email: string;
  address: PostalAddress;
  sameAs: string[];
};
export type EventNode = {
  "@type": "Event";
  name: string;
  description: string;
  eventAttendanceMode: string;
  eventSchedule: Schedule;
  location: Place;
  organizer: { "@id": string };
};
export type JsonLd = { "@context": "https://schema.org"; "@graph": (ChurchNode | EventNode)[] };

/** "Temple, GA 30179" split into locality, region and postcode; anything else stays the locality */
export function postalAddress(address: SiteContent["contact"]["address"]): PostalAddress {
  const streetAddress = [address.street, address.suite].filter(Boolean).join(" ");
  const parts = /^(.+?),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/.exec(address.city);
  if (!parts) return { "@type": "PostalAddress", streetAddress, addressLocality: address.city };
  return {
    "@type": "PostalAddress",
    streetAddress,
    addressLocality: parts[1],
    addressRegion: parts[2],
    postalCode: parts[3],
  };
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const WEEK_ORDINALS = ["first", "second", "third", "fourth", "fifth"];

/**
 * A gathering's schedule read out of its own `when` line — "Every Sunday ·
 * 10:30 a.m. · …", "First Sunday of the month · …" — so a fact that is not
 * in the words is not in the schedule either: no clock time in the line,
 * no startTime.
 */
export function schedule(when: string): Schedule {
  const out: Schedule = { "@type": "Schedule" };
  const day = DAYS.find((d) => new RegExp(`\\b${d}\\b`, "i").test(when));
  if (day) out.byDay = `https://schema.org/${day}`;
  const ordinal = WEEK_ORDINALS.findIndex((o) => new RegExp(`\\b${o}\\s+${day ?? "\\w+"}\\s+of\\s+(the|each|every)\\s+month\\b`, "i").test(when));
  if (ordinal > -1) {
    out.byMonthWeek = ordinal + 1;
    out.repeatFrequency = "P1M";
  } else if (day && new RegExp(`\\bevery\\s+${day}\\b`, "i").test(when)) {
    out.repeatFrequency = "P1W";
  }
  const time = /\b(\d{1,2}):(\d{2})\s*([ap])\.?m\.?/i.exec(when);
  if (time) {
    const hour = (Number(time[1]) % 12) + (time[3].toLowerCase() === "p" ? 12 : 0);
    out.startTime = `${String(hour).padStart(2, "0")}:${time[2]}`;
  }
  return out;
}

/** the part of a `when` line that names somewhere ("five homes across West Georgia"), if any */
export function placeName(when: string): string | undefined {
  return when.split(" · ").find((part) => /\b(across|in|at|near)\s+[A-Z]/.test(part));
}

/**
 * The collective as a schema.org Church and each gathering as an Event at
 * a Place with the published address, on the schedule its own line gives.
 * Only what site.ts says: no address or time is invented.
 */
export function jsonLd(site: SiteContent, opts: SurfaceOptions): JsonLd {
  const url = siteUrl(opts);
  const id = `${url}#church`;
  const address = postalAddress(site.contact.address);
  const church: ChurchNode = {
    "@type": "Church",
    "@id": id,
    name: site.name,
    ...(site.footer.copyright !== site.name ? { alternateName: site.footer.copyright } : {}),
    url,
    description: description(site),
    image: siteFile(opts, SHARE_IMAGE.file),
    email: site.contact.email,
    address,
    sameAs: site.socials.map((s) => s.href).filter((href) => /^https?:/.test(href)),
  };
  const events: EventNode[] = site.gatherings.map((g) => ({
    "@type": "Event",
    name: g.title,
    description: g.body,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventSchedule: schedule(g.when),
    location: { "@type": "Place", name: placeName(g.when) ?? site.name, address },
    organizer: { "@id": id },
  }));
  return { "@context": "https://schema.org", "@graph": [church, ...events] };
}

/** the graph as a head script; `<` is escaped so no content can close the tag */
export function jsonLdTag(site: SiteContent, opts: SurfaceOptions): SurfaceTag {
  return {
    tag: "script",
    attrs: { type: "application/ld+json" },
    children: JSON.stringify(jsonLd(site, opts)).replace(/</g, "\\u003c"),
    injectTo: "head",
  };
}

// ---- llms.txt ------------------------------------------------------------

/** the files at the site root for readers that do not run scripts */
export const LLMS_FILE = "llms.txt";
export const LLMS_FULL_FILE = "llms-full.txt";

/** the address on one line: "104 West Perennial Drive #100, Temple, GA 30179" */
export function addressLine(address: SiteContent["contact"]["address"]): string {
  return `${[address.street, address.suite].filter(Boolean).join(" ")}, ${address.city}`;
}

const mdLink = (label: string, href: string): string => `[${label}](${href})`;

/**
 * llms.txt, short: what the collective is, where and when it meets, and
 * where to read more — the title, a blockquote summary and a links section,
 * as the llms.txt convention lays it out.
 */
export function llmsTxt(site: SiteContent, opts: SurfaceOptions): string {
  const url = siteUrl(opts);
  const about = scene(site, "about");
  const ctas = site.scene.flatMap((s) => (s.cta && /^https?:/.test(s.cta.href) ? [s.cta] : []));
  const lines = [
    `# ${site.name}`,
    "",
    `> ${description(site)}`,
    "",
    ...(about ? [about.heading, "", ...about.body.slice(0, 1), ""] : []),
    ...site.gatherings.map((g) => `- ${g.title}: ${g.when}`),
    `- ${addressLine(site.contact.address)}`,
    `- ${site.contact.email}`,
    "",
    "## Links",
    "",
    `- ${mdLink(site.name, url)}`,
    `- ${mdLink(WHOLE_SITE_LABEL, siteFile(opts, LLMS_FULL_FILE))}`,
    `- ${mdLink(site.messages.all.label, site.messages.all.href)}`,
    ...ctas.map((c) => `- ${mdLink(c.label, c.href)}`),
    ...site.socials.filter((s) => /^https?:/.test(s.href)).map((s) => `- ${mdLink(s.label, s.href)}`),
    "",
  ];
  return lines.join("\n");
}

/** the link from llms.txt to llms-full.txt (framing copy; not in site.ts) */
export const WHOLE_SITE_LABEL = "The whole site, in plain words";

// ---- the whole site: one outline, rendered as Markdown and as HTML --------

/** a run of text: linked when `href` is set, bold when `strong` */
export type Run = { text: string; href?: string; strong?: boolean };

/** a block of the outline; the same list renders as Markdown (llms-full.txt) and as HTML (the noscript block) */
export type Block =
  | { kind: "heading"; level: 1 | 2 | 3 | 4; text: string }
  | { kind: "para"; runs: Run[] }
  /** an aside in italics: a time, a scripture reference */
  | { kind: "note"; text: string }
  | { kind: "quote"; text: string; ref: string }
  | { kind: "list"; ordered: boolean; items: Run[][] };

/** framing copy that is not in site.ts: the line under the title, and the heading over the way in */
export const WHOLE_SITE_INTRO =
  "The whole site in plain words: who we are, where and when we meet, what we believe, and the way in.";
export const WAY_IN_HEADING = "The way in";
export const LEAD_PASTOR_LABEL = "Lead pastor";

const h = (level: 1 | 2 | 3 | 4, text: string): Block => ({ kind: "heading", level, text });
const p = (...runs: (Run | string)[]): Block => ({
  kind: "para",
  runs: runs.map((r) => (typeof r === "string" ? { text: r } : r)),
});
const note = (text: string): Block => ({ kind: "note", text });
const link = (text: string, href: string): Run => ({ text, href });
const mail = (email: string): Run => link(email, `mailto:${email}`);

/** the site as an outline, in page order: the stops, the long-form, the footer */
export function outline(site: SiteContent, opts: SurfaceOptions): Block[] {
  const hero = scene(site, "hero");
  const blocks: Block[] = [h(1, site.name)];
  if (hero) blocks.push(p(hero.heading), ...(hero.kicker ? [note(hero.kicker)] : []));
  blocks.push(p(WHOLE_SITE_INTRO), p(link(site.name, siteUrl(opts))));

  for (const stop of site.scene) {
    if (stop.id === "hero") continue;
    blocks.push(h(2, stop.kicker ?? stop.label));
    if (stop.heading !== stop.kicker) blocks.push(h(3, stop.heading));
    blocks.push(...stop.body.map((text) => p(text)));
    if (stop.id === "gatherings") {
      for (const g of site.gatherings) blocks.push(h(4, g.title), note(g.when), p(g.body));
    }
    if (stop.id === "visit") {
      blocks.push(h(3, WAY_IN_HEADING), {
        kind: "list",
        ordered: true,
        items: (site.wayIn ?? []).map((w) => [{ text: w.title, strong: true }, { text: ` ${w.body}` }]),
      });
    }
    if (stop.cta) blocks.push(p(link(stop.cta.label, stop.cta.href)));
    if (stop.id === "visit") {
      const { address, email, pastor } = site.contact;
      blocks.push(
        p(addressLine(address)),
        p(`${site.footer.gathering} · ${site.contact.sunday}`),
        p(mail(email)),
        p(`${LEAD_PASTOR_LABEL}: ${pastor.name} — `, mail(pastor.email)),
      );
    }
  }

  for (const section of site.longform) {
    blocks.push(h(2, section.kicker), h(3, section.heading));
    if (section.intro) blocks.push(p(section.intro));
    switch (section.id) {
      case "devotions":
        for (const d of site.devotions) blocks.push(h(4, d.title), note(d.refs), p(d.body));
        break;
      case "beliefs":
        for (const b of site.beliefPosture) blocks.push(p(b.line), { kind: "quote", text: b.quote, ref: b.ref });
        for (const b of site.beliefs) blocks.push(h(4, b.title), p(b.body), note(b.refs));
        break;
      case "faq":
        for (const q of site.faq) blocks.push(h(4, q.question), p(q.answer));
        break;
      case "messages":
        blocks.push(
          {
            kind: "list",
            ordered: false,
            items: site.messages.latest.map((m) => [link(m.title, m.href), { text: ` — ${m.date} · ${m.passage} · ${m.speaker}` }]),
          },
          p(link(site.messages.all.label, site.messages.all.href)),
        );
        break;
    }
  }

  blocks.push(
    h(2, site.footer.follow),
    { kind: "list", ordered: false, items: site.socials.map((s) => [link(s.label, s.href)]) },
    p(`© ${site.footer.copyright}`),
  );
  return blocks;
}

const mdRun = (r: Run): string => {
  const text = r.strong ? `**${r.text}**` : r.text;
  return r.href ? `[${text}](${r.href})` : text;
};
const mdRuns = (runs: Run[]): string => runs.map(mdRun).join("");

/** the outline as Markdown */
export function renderMarkdown(blocks: Block[]): string {
  const out = blocks.map((b) => {
    switch (b.kind) {
      case "heading":
        return `${"#".repeat(b.level)} ${b.text}`;
      case "para":
        return mdRuns(b.runs);
      case "note":
        return `*${b.text}*`;
      case "quote":
        return `> ${b.text}\n> — ${b.ref}`;
      case "list":
        return b.items.map((runs, i) => `${b.ordered ? `${i + 1}.` : "-"} ${mdRuns(runs)}`).join("\n");
    }
  });
  return `${out.join("\n\n")}\n`;
}

const htmlRun = (r: Run): string => {
  const text = r.strong ? `<strong>${escapeXml(r.text)}</strong>` : escapeXml(r.text);
  return r.href ? `<a href="${escapeXml(r.href)}">${text}</a>` : text;
};
const htmlRuns = (runs: Run[]): string => runs.map(htmlRun).join("");

/** the outline as plain HTML, escaped, with no classes or ids */
export function renderHtml(blocks: Block[]): string {
  return blocks
    .map((b) => {
      switch (b.kind) {
        case "heading":
          return `<h${b.level}>${escapeXml(b.text)}</h${b.level}>`;
        case "para":
          return `<p>${htmlRuns(b.runs)}</p>`;
        case "note":
          return `<p><em>${escapeXml(b.text)}</em></p>`;
        case "quote":
          return `<blockquote><p>${escapeXml(b.text)}</p><p>— ${escapeXml(b.ref)}</p></blockquote>`;
        case "list": {
          const tag = b.ordered ? "ol" : "ul";
          return `<${tag}>${b.items.map((runs) => `<li>${htmlRuns(runs)}</li>`).join("")}</${tag}>`;
        }
      }
    })
    .join("");
}

/** llms-full.txt: the whole site in Markdown, from the outline */
export function llmsFullTxt(site: SiteContent, opts: SurfaceOptions): string {
  return renderMarkdown(outline(site, opts));
}

/**
 * The noscript block: the same outline as plain HTML, readable when scripts
 * are off — the page paints cream with ink type (over the inline ink the
 * head puts on the document and the body, src/features/intro/staticSplash.ts),
 * and the static splash (`splashSelector`, which would otherwise sit over
 * everything) is hidden.
 */
export function noscriptBlock(site: SiteContent, opts: SurfaceOptions & { splashSelector?: string }): string {
  const style =
    `html,body{background:${tokens.cream}}` +
    `article{max-width:40rem;margin:0 auto;padding:2rem 1.25rem;color:${tokens.ink};font-family:Georgia,serif;line-height:1.5}` +
    `article a{color:${tokens.seal}}` +
    (opts.splashSelector ? `${opts.splashSelector}{display:none}` : "");
  return `<noscript><style>${style}</style><article>${renderHtml(outline(site, opts))}</article></noscript>`;
}
