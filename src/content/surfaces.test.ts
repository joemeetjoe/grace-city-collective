import { describe, expect, it } from "vitest";

import { site, wayIn } from "./site";
import {
  addressLine,
  description,
  headTags,
  jsonLd,
  jsonLdTag,
  llmsFullTxt,
  llmsTxt,
  noscriptBlock,
  robotsTxt,
  sitemapXml,
  type ChurchNode,
  type EventNode,
} from "./surfaces";
import { tokens } from "../theme/tokens";

const opts = { origin: "https://example.test", base: "/" };

const attrsOf = (tags: ReturnType<typeof headTags>, tag: string, key: string, value: string) =>
  tags.find((t) => t.tag === tag && t.attrs?.[key] === value)?.attrs;

describe("headTags", () => {
  const tags = headTags(site, opts);

  it("describes the page from the hero and the collective's own words", () => {
    const description = attrsOf(tags, "meta", "name", "description")?.content;
    expect(description).toContain("living rooms across the city");
    expect(description).toContain("West Georgia");
  });

  it("points the canonical at the site root under the origin", () => {
    expect(attrsOf(tags, "link", "rel", "canonical")?.href).toBe("https://example.test/");
  });

  it("carries the required Open Graph set with absolute URLs", () => {
    const og = (p: string) => attrsOf(tags, "meta", "property", p)?.content;
    expect(og("og:type")).toBe("website");
    expect(og("og:title")).toContain(site.name);
    expect(og("og:description")).toBeTruthy();
    expect(og("og:url")).toBe("https://example.test/");
    expect(og("og:image")).toBe("https://example.test/share.jpg");
    expect(og("og:image:width")).toBe("1200");
    expect(og("og:image:height")).toBe("630");
  });

  it("asks Twitter for the large card", () => {
    const tw = (n: string) => attrsOf(tags, "meta", "name", n)?.content;
    expect(tw("twitter:card")).toBe("summary_large_image");
    expect(tw("twitter:image")).toBe("https://example.test/share.jpg");
  });

  it("paints the browser chrome in ink", () => {
    expect(attrsOf(tags, "meta", "name", "theme-color")?.content).toBe(tokens.ink);
  });

  it("folds the base path into every absolute URL", () => {
    const under = headTags(site, { origin: "https://example.test", base: "/repo/" });
    expect(attrsOf(under, "link", "rel", "canonical")?.href).toBe("https://example.test/repo/");
    expect(attrsOf(under, "meta", "property", "og:image")?.content).toBe("https://example.test/repo/share.jpg");
  });
});

describe("description", () => {
  it("ends in one full stop, even after an abbreviation", () => {
    expect(description(site)).toMatch(/[^.]\.$/);
  });
});

describe("robotsTxt", () => {
  const robots = robotsTxt(opts);

  it("allows every crawler, AI crawlers included, with no carve-out", () => {
    expect(robots).toMatch(/^User-agent: \*$/m);
    expect(robots).toMatch(/^Allow: \/$/m);
    expect(robots).not.toMatch(/Disallow/);
    for (const bot of ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended"]) expect(robots).not.toContain(bot);
  });

  it("names the sitemap by absolute URL", () => {
    expect(robots).toMatch(/^Sitemap: https:\/\/example\.test\/sitemap\.xml$/m);
  });
});

describe("sitemapXml", () => {
  it("lists the one URL", () => {
    const xml = sitemapXml(opts);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml.match(/<loc>/g)).toHaveLength(1);
    expect(xml).toContain("<loc>https://example.test/</loc>");
  });
});

describe("jsonLd", () => {
  const graph = jsonLd(site, opts)["@graph"];
  const church = graph.find((n): n is ChurchNode => n["@type"] === "Church")!;
  const events = graph.filter((n): n is EventNode => n["@type"] === "Event");

  it("is the collective as a Church at the site URL, with its address and email", () => {
    expect(jsonLd(site, opts)["@context"]).toBe("https://schema.org");
    expect(church.name).toBe(site.name);
    expect(church.url).toBe("https://example.test/");
    expect(church.description).toBe(description(site));
    expect(church.image).toBe("https://example.test/share.jpg");
    expect(church.email).toBe(site.contact.email);
    expect(church.address).toEqual({
      "@type": "PostalAddress",
      streetAddress: "104 West Perennial Drive #100",
      addressLocality: "Temple",
      addressRegion: "GA",
      postalCode: "30179",
    });
    expect(church.sameAs).toEqual(site.socials.filter((s) => s.href.startsWith("http")).map((s) => s.href));
  });

  it("lists one Event per gathering, at a Place with the address, organised by the church", () => {
    expect(events.map((e) => e.name)).toEqual(site.gatherings.map((g) => g.title));
    for (const event of events) {
      expect(event.location["@type"]).toBe("Place");
      expect(event.location.address).toEqual(church.address);
      expect(event.organizer).toEqual({ "@id": church["@id"] });
    }
  });

  it("reads each gathering's schedule from its own words, and invents no time", () => {
    const [homes, feast] = events;
    expect(homes.eventSchedule).toEqual({
      "@type": "Schedule",
      byDay: "https://schema.org/Sunday",
      repeatFrequency: "P1W",
      startTime: "10:30",
    });
    // the feast names no clock time, so its schedule carries none
    expect(feast.eventSchedule).toEqual({
      "@type": "Schedule",
      byDay: "https://schema.org/Sunday",
      byMonthWeek: 1,
      repeatFrequency: "P1M",
    });
  });

  it("names the place from the gathering when it says one", () => {
    expect(events[0].location.name).toBe("five homes across West Georgia");
    expect(events[1].location.name).toBe(site.name);
  });

  it("serialises to a script tag that parses back", () => {
    const tag = jsonLdTag(site, opts);
    expect(tag.attrs?.type).toBe("application/ld+json");
    expect(JSON.parse(tag.children!)).toEqual(jsonLd(site, opts));
    expect(tag.children).not.toContain("</");
  });
});

describe("llmsTxt", () => {
  const txt = llmsTxt(site, opts);

  it("opens with the name and a one-line summary, as llms.txt asks", () => {
    expect(txt.startsWith(`# ${site.name}\n\n> `)).toBe(true);
    expect(txt.split("\n")[2]).toContain("West Georgia");
  });

  it("says where and when, in the site's own words", () => {
    for (const g of site.gatherings) expect(txt).toContain(g.when);
    expect(txt).toContain(site.contact.address.street);
    expect(txt).toContain(site.contact.email);
  });

  it("links the site, the full text and the site's own links, absolutely", () => {
    expect(txt).toContain("## Links");
    expect(txt).toContain("](https://example.test/)");
    expect(txt).toContain("](https://example.test/llms-full.txt)");
    expect(txt).toContain(`[${site.messages.all.label}](${site.messages.all.href})`);
  });

  it("stays short", () => {
    expect(txt.split("\n").length).toBeLessThan(40);
  });
});

describe("llmsFullTxt", () => {
  const md = llmsFullTxt(site, opts);

  it("is the whole site in Markdown: stops, gatherings, the way in, devotions, beliefs, FAQ, messages", () => {
    expect(md.startsWith(`# ${site.name}\n`)).toBe(true);
    for (const s of site.scene) if (s.body.length) expect(md).toContain(`### ${s.heading}`);
    for (const s of site.longform) expect(md).toContain(`## ${s.kicker}`);
    for (const g of site.gatherings) expect(md).toContain(`#### ${g.title}\n\n*${g.when}*`);
    for (const w of wayIn(site)) expect(md).toContain(`**${w.title}** ${w.body}`);
    for (const d of site.devotions) expect(md).toContain(`#### ${d.title}\n\n*${d.refs}*\n\n${d.body}`);
    for (const b of site.beliefs) expect(md).toContain(`#### ${b.title}`);
    for (const p of site.beliefPosture) expect(md).toContain(`> ${p.quote}\n> — ${p.ref}`);
    for (const q of site.faq) expect(md).toContain(`#### ${q.question}\n\n${q.answer}`);
    for (const m of site.messages.latest) expect(md).toContain(`- [${m.title}](${m.href}) — ${m.date} · ${m.passage} · ${m.speaker}`);
  });

  it("gives the address, the emails and the site's links", () => {
    expect(md).toContain(addressLine(site.contact.address));
    expect(md).toContain(`[${site.contact.email}](mailto:${site.contact.email})`);
    expect(md).toContain(`${site.contact.pastor.name} — [${site.contact.pastor.email}](mailto:${site.contact.pastor.email})`);
    for (const s of site.scene) if (s.cta) expect(md).toContain(`[${s.cta.label}](${s.cta.href})`);
    expect(md).toContain(`[${site.messages.all.label}](${site.messages.all.href})`);
    expect(md).toContain("https://example.test/");
  });

  it("ends on the copyright line", () => {
    expect(md.trimEnd().endsWith(`© ${site.footer.copyright}`)).toBe(true);
  });
});

describe("noscriptBlock", () => {
  const html = noscriptBlock(site, { ...opts, splashSelector: "[data-splash]" });

  it("is one noscript element carrying the same outline as plain HTML", () => {
    expect(html.startsWith("<noscript>")).toBe(true);
    expect(html.endsWith("</noscript>")).toBe(true);
    expect(html.match(/<noscript>/g)).toHaveLength(1);
    expect(html).toContain(`<h1>${site.name}</h1>`);
    for (const s of site.longform) expect(html).toContain(`<h2>${s.kicker}</h2>`);
    for (const d of site.devotions) expect(html).toContain(`<h4>${d.title}</h4>`);
    for (const q of site.faq) expect(html).toContain(`<h4>${q.question}</h4>`);
    for (const m of site.messages.latest) expect(html).toContain(`<a href="${m.href}">${m.title}</a>`);
  });

  it("escapes the content's own markup characters", () => {
    const spiky = { ...site, name: 'A <b>"&"</b>' };
    expect(noscriptBlock(spiky, opts)).toContain("<h1>A &lt;b&gt;&quot;&amp;&quot;&lt;/b&gt;</h1>");
  });

  it("hides the static splash and paints cream, so the page can be read without scripts", () => {
    expect(html).toContain("[data-splash]{display:none}");
    expect(html).toContain(`html,body{background:${tokens.cream}}`);
    expect(noscriptBlock(site, opts)).not.toContain("display:none");
  });

  it("carries the same words as the Markdown, in the same order", () => {
    const text = (s: string) =>
      s
        .replace(/<[^>]+>/g, " ")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&")
        .replace(/&#39;/g, "'")
        .replace(/^#+ |^> |^- |^\d+\. |\*|\[|\]\([^)]*\)/gm, " ")
        .replace(/\s+/g, " ")
        .trim();
    const fromHtml = text(html.replace(/<style>[\s\S]*?<\/style>/, ""));
    const fromMd = text(llmsFullTxt(site, opts));
    expect(fromHtml).toBe(fromMd);
  });
});

describe("one heading change flows through every surface", () => {
  const edit = (content: typeof site, id: string, heading: string) => ({
    ...content,
    scene: content.scene.map((s) => (s.id === id ? { ...s, heading } : s)),
  });
  const changed = edit(site, "hero", "A different headline.");

  it("changes llms-full.txt, the noscript block and the JSON-LD from the same edit", () => {
    expect(llmsFullTxt(changed, opts)).not.toBe(llmsFullTxt(site, opts));
    expect(llmsFullTxt(changed, opts)).toContain("A different headline.");

    expect(noscriptBlock(changed, opts)).not.toBe(noscriptBlock(site, opts));
    expect(noscriptBlock(changed, opts)).toContain("A different headline.");

    expect(jsonLd(changed, opts)).not.toEqual(jsonLd(site, opts));
    expect(JSON.stringify(jsonLd(changed, opts))).toContain("A different headline.");
  });

  it("carries a renamed gathering into the Events, the Markdown and the HTML alike", () => {
    const renamed = { ...site, gatherings: site.gatherings.map((g, i) => (i ? g : { ...g, title: "Supper Clubs" })) };
    expect(jsonLd(renamed, opts)["@graph"].some((n) => n["@type"] === "Event" && n.name === "Supper Clubs")).toBe(true);
    expect(llmsFullTxt(renamed, opts)).toContain("#### Supper Clubs");
    expect(noscriptBlock(renamed, opts)).toContain("<h4>Supper Clubs</h4>");
    expect(llmsTxt(renamed, opts)).toContain("Supper Clubs");
  });
});
