/**
 * Runtime check that a JSON document is a `SiteContent`.
 *
 * The site fetches `content/site.json` at runtime and the editor Lambda
 * accepts whatever an editor posts, so both need to know the document has
 * the shape `site.ts` declares before trusting it. This is a hand-written
 * mirror of the `SiteContent` type: no dependency, readable error paths
 * (`scene[2].heading: expected string`), and every problem reported at once.
 * Swap for zod once it is a direct dependency; the result shape stays.
 */

import { GATHERING_MARKS, type LongformId, type SceneId, type SectionId, type SiteContent } from "./site";

export type ValidationResult = { ok: true; value: SiteContent } | { ok: false; errors: string[] };

type Check = (value: unknown, path: string, errors: string[]) => void;

export const SCENE_IDS: readonly SceneId[] = ["hero", "about", "house-churches", "gatherings", "give", "visit"];
export const LONGFORM_IDS: readonly LongformId[] = ["devotions", "beliefs", "faq", "messages"];
export const SECTION_IDS: readonly SectionId[] = [...SCENE_IDS, ...LONGFORM_IDS];

function at(path: string, key: string): string {
  return path ? `${path}.${key}` : key;
}

function label(path: string, message: string): string {
  return path ? `${path}: ${message}` : message;
}

const str: Check = (value, path, errors) => {
  if (value === undefined) errors.push(label(path, "missing, expected string"));
  else if (typeof value !== "string") errors.push(label(path, "expected string"));
};

function oneOf(options: readonly string[]): Check {
  return (value, path, errors) => {
    if (value === undefined) errors.push(label(path, `missing, expected one of ${options.join(", ")}`));
    else if (typeof value !== "string" || !options.includes(value)) {
      errors.push(label(path, `expected one of ${options.join(", ")}`));
    }
  };
}

function arr(item: Check): Check {
  return (value, path, errors) => {
    if (value === undefined) errors.push(label(path, "missing, expected array"));
    else if (!Array.isArray(value)) errors.push(label(path, "expected array"));
    else value.forEach((v, i) => item(v, `${path}[${i}]`, errors));
  };
}

function optional(check: Check): Check {
  return (value, path, errors) => {
    if (value !== undefined) check(value, path, errors);
  };
}

function obj(shape: Record<string, Check>): Check {
  return (value, path, errors) => {
    if (value === undefined) {
      errors.push(label(path, "missing, expected object"));
      return;
    }
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      errors.push(label(path, "expected object"));
      return;
    }
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      if (!(key in shape)) errors.push(label(path, `unknown key "${key}"`));
    }
    for (const [key, check] of Object.entries(shape)) check(record[key], at(path, key), errors);
  };
}

const link = obj({ label: str, href: str });

const siteShape = obj({
  name: str,
  nav: arr(obj({ label: str, id: oneOf(SECTION_IDS) })),
  scene: arr(
    obj({
      id: oneOf(SCENE_IDS),
      label: str,
      kicker: optional(str),
      heading: str,
      body: arr(str),
      cta: optional(link),
    }),
  ),
  gatherings: arr(obj({ mark: optional(oneOf(GATHERING_MARKS)), title: str, when: str, body: str })),
  longform: arr(obj({ id: oneOf(LONGFORM_IDS), kicker: str, heading: str, intro: optional(str) })),
  devotionsIntro: str,
  devotions: arr(obj({ title: str, refs: str, body: str })),
  beliefPosture: arr(obj({ line: str, quote: str, ref: str })),
  beliefs: arr(obj({ title: str, body: str, refs: str })),
  faq: arr(obj({ question: str, answer: str })),
  messages: obj({
    series: str,
    latest: arr(obj({ title: str, date: str, passage: str, speaker: str, href: str })),
    all: link,
  }),
  contact: obj({
    sunday: str,
    address: obj({ street: str, suite: str, city: str }),
    email: str,
    pastor: obj({ name: str, email: str }),
  }),
  socials: arr(link),
  footer: obj({ follow: str, copyright: str }),
});

export function validateSite(input: unknown): ValidationResult {
  const errors: string[] = [];
  siteShape(input, "", errors);
  return errors.length ? { ok: false, errors } : { ok: true, value: input as SiteContent };
}
