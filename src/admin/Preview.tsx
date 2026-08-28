/**
 * A plain typographic rendering of one top-level section of the content:
 * headings in the serif, kickers in small caps, prose as paragraphs. Not
 * the page's layout — that needs the scene — but enough to read the words
 * in proportion while they are being edited.
 */

import type { ReactNode } from "react";

const serif = "[font-family:'Cormorant_Garamond',Georgia,serif]";
const HEADING = new Set(["heading", "title", "question", "line", "name", "series"]);
const KICKER = new Set(["kicker", "when", "refs", "ref", "date", "passage", "speaker", "label", "sunday", "follow"]);
const MUTED = new Set(["href", "email", "id", "copyright"]);

function Node({ value, name }: { value: unknown; name?: string }): ReactNode {
  if (typeof value === "string") {
    if (name && HEADING.has(name)) return <h3 className={`text-[26px] leading-[1.1] text-cream ${serif}`}>{value}</h3>;
    if (name && KICKER.has(name)) return <p className="text-[10px] uppercase tracking-[0.24em] text-seal">{value}</p>;
    if (name && MUTED.has(name)) return <p className="text-xs text-cream/40">{value}</p>;
    return <p className="text-[15px] leading-relaxed text-cream/80">{value}</p>;
  }
  if (Array.isArray(value)) {
    return (
      <div className="flex flex-col gap-5">
        {value.map((item, i) => (
          <div key={i} className="flex flex-col gap-2 border-t border-cream/15 pt-4 first:border-t-0 first:pt-0">
            <Node value={item} name={name} />
          </div>
        ))}
      </div>
    );
  }
  if (value && typeof value === "object") {
    return (
      <div className="flex flex-col gap-2">
        {Object.entries(value).map(([k, v]) => (
          <Node key={k} value={v} name={k} />
        ))}
      </div>
    );
  }
  return null;
}

export function Preview({ section, value }: { section: string; value: unknown }) {
  return (
    <div data-testid="preview" className="flex flex-col gap-4">
      <p className="text-[10px] uppercase tracking-[0.24em] text-cream/40">Preview · {section}</p>
      <Node value={value} name={section} />
    </div>
  );
}
