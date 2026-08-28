/**
 * A form generated from the content's shape: strings become inputs or
 * textareas, arrays get add/remove, objects nest. Every control is
 * labelled with its path (`scene[2].heading`), the same label the validator
 * puts in an error, so an error line points straight at a field.
 */

import type { ReactNode } from "react";

import { applyFieldEdit, pathLabel, type Path } from "./applyFieldEdit";
import { LONGFORM_IDS, SCENE_IDS, SECTION_IDS } from "@/content/schema";
import { site, type SiteContent } from "@/content/site";

/** keys whose strings are prose, so they get a textarea */
const LONG_KEYS = new Set(["body", "answer", "quote", "intro", "devotionsIntro"]);

/** enumerated ids: the top-level array decides which set applies */
function idOptions(path: Path): readonly string[] | null {
  if (path[path.length - 1] !== "id") return null;
  if (path[0] === "scene") return SCENE_IDS;
  if (path[0] === "longform") return LONGFORM_IDS;
  if (path[0] === "nav") return SECTION_IDS;
  return null;
}

function getIn(node: unknown, path: Path): unknown {
  return path.reduce<unknown>((acc, key) => (acc as Record<string | number, unknown> | undefined)?.[key], node);
}

/** a blank copy of a sample item: strings emptied, arrays emptied, ids kept */
function blankLike(sample: unknown): unknown {
  if (typeof sample === "string") return "";
  if (Array.isArray(sample)) return [];
  if (sample && typeof sample === "object") {
    return Object.fromEntries(Object.entries(sample).map(([k, v]) => [k, k === "id" ? v : blankLike(v)]));
  }
  return sample;
}

/** what a new element of the array at `path` should look like */
function templateFor(path: Path, current: unknown[]): unknown {
  const sample = current[current.length - 1] ?? (getIn(site, path) as unknown[] | undefined)?.[0] ?? "";
  return blankLike(sample);
}

function humanize(key: string | number): string {
  return String(key)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase();
}

const inputCls =
  "w-full rounded-md border border-cream/20 bg-cream/5 px-3 py-2 text-[15px] text-cream outline-none transition-colors focus:border-seal";
const smallBtn =
  "rounded-full border border-cream/30 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-cream/70 transition-colors hover:border-cream hover:text-cream";

type FieldProps = {
  content: SiteContent;
  path: Path;
  onChange: (next: SiteContent) => void;
};

export function Field({ content, path, onChange }: FieldProps): ReactNode {
  const value = getIn(content, path);
  const key = path[path.length - 1];
  const label = pathLabel(path);
  const set = (v: unknown) => onChange(applyFieldEdit(content, path, v));

  if (typeof value === "string") {
    const options = idOptions(path);
    if (options) {
      return (
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.18em] text-cream/50">{humanize(key)}</span>
          <select aria-label={label} value={value} onChange={(e) => set(e.target.value)} className={inputCls}>
            <option value="">—</option>
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
      );
    }
    const long = LONG_KEYS.has(String(key)) || (typeof key === "number" && LONG_KEYS.has(String(path[path.length - 2]))) || value.length > 90;
    return (
      <label className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-[0.18em] text-cream/50">{humanize(key)}</span>
        {long ? (
          <textarea aria-label={label} value={value} rows={Math.min(8, Math.max(2, Math.ceil(value.length / 80)))} onChange={(e) => set(e.target.value)} className={`${inputCls} leading-relaxed`} />
        ) : (
          <input aria-label={label} type="text" value={value} onChange={(e) => set(e.target.value)} className={inputCls} />
        )}
      </label>
    );
  }

  if (Array.isArray(value)) {
    const items = value as unknown[];
    const add = () => set([...items, templateFor(path, items)]);
    const remove = (i: number) => set(items.filter((_, j) => j !== i));
    return (
      <div className="flex flex-col gap-4">
        {items.map((_, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-lg border border-cream/15 p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.18em] text-seal">{pathLabel([...path, i])}</span>
              <button type="button" onClick={() => remove(i)} aria-label={`Remove ${pathLabel([...path, i])}`} className={smallBtn}>
                Remove
              </button>
            </div>
            <Field content={content} path={[...path, i]} onChange={onChange} />
          </div>
        ))}
        <button type="button" onClick={add} aria-label={`Add ${label} item`} className={`${smallBtn} self-start`}>
          Add {humanize(key)}
        </button>
      </div>
    );
  }

  if (value && typeof value === "object") {
    return (
      <div className="flex flex-col gap-4">
        {Object.keys(value).map((k) => (
          <Field key={k} content={content} path={[...path, k]} onChange={onChange} />
        ))}
      </div>
    );
  }

  return null;
}
