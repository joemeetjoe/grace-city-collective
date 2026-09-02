import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A textual lint over src for the keys and types sweep (#127): what the
 * audit found is fixed, and a new instance is a regression. It reads text,
 * not types, so each rule is a pattern with the exceptions it cannot see
 * past written out here, and a stale exception fails too.
 *
 * Out of its sight: features/intro (#124 rewrites the handoff, the gate and
 * the splash — its `!`, its `querySelector<…>` generics and its `laidOut`
 * predicate wait for that; lift INTRO once it has landed), and the keys of
 * the four ornaments #125 reshapes (ORNAMENTS).
 */

const SRC = resolve(__dirname, "..");

/** every source file under src, tests, the test setup and the ambient declarations aside */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "test" ? [] : sources(path);
    if (!/\.tsx?$/.test(name) || /\.test\.tsx?$/.test(name) || name.endsWith(".d.ts")) return [];
    return [path];
  });
}

type Source = { file: string; text: string; lines: string[] };

const FILES: Source[] = sources(SRC).map((path) => {
  const text = readFileSync(path, "utf8");
  return { file: relative(SRC, path), text, lines: text.split("\n") };
});

/** #124's files */
const INTRO = /^features\/intro\//;

/** #125's files: their keys are its to settle */
const ORNAMENTS = new Set([
  "features/stops/HouseTable.tsx",
  "features/stops/SharedLife.tsx",
  "features/stops/GatheringCalendar.tsx",
  "features/stops/WayIn.tsx",
]);

/** a line of code, not a comment */
const isCode = (line: string) => !/^\s*(\/\/|\*|\/\*)/.test(line);

/** `${file}:${line}` for every code line matching `re` */
function matches(re: RegExp, skip: (file: string) => boolean = () => false): string[] {
  return FILES.flatMap(({ file, lines }) =>
    skip(file)
      ? []
      : lines.flatMap((line, i) => (isCode(line) && re.test(line) ? [`${file}:${i + 1} ${line.trim()}`] : [])),
  );
}

/**
 * A key the rule cannot read as an id, and why it stands: a remount key on
 * one element, a list of strings with no ids in the content, and the seal's
 * static art keyed by what names its parts.
 */
const KEY_EXCEPTIONS: Record<string, string[]> = {
  // the step's words remount to replay their rise: a state key on one element, not a list key
  "features/stops/VisitStop.tsx": ["way.step"],
  // a stop's paragraphs are strings in the content (SceneSection.body: string[]); nothing else names one
  "features/stops/StopWords.tsx": ["p"],
  // the passages of a refs string, split on `;`: their text is all that names them, and the index guards a repeat
  "features/longform/ScriptureRefs.tsx": ["`${i}-${ref}`"],
  // static art: each shade ring by its stroke width, unique in its list; each fleur part by its name in FLEUR
  "marks/Seal.tsx": ["w", "w", "w", "k", "w"],
};

/** the expression of every `key=` in a file, in order: `key="…"` as the quoted literal, `key={…}` as the braces' contents */
function keysOf(text: string): string[] {
  const keys: string[] = [];
  const re = /\bkey=(?:"([^"]*)"|\{)/g;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m[1] !== undefined) {
      keys.push(`"${m[1]}"`);
      continue;
    }
    let i = m.index + m[0].length;
    let depth = 1;
    const start = i;
    while (i < text.length && depth > 0) {
      const ch = text[i];
      if (ch === "`") {
        i = text.indexOf("`", i + 1);
        if (i < 0) break;
      } else if (ch === "{") depth += 1;
      else if (ch === "}") depth -= 1;
      i += 1;
    }
    keys.push(text.slice(start, i - 1).trim());
  }
  return keys;
}

/** an id: a string literal, or `id`, a member `….id` or a `…Id` */
const isIdKey = (key: string) => /^"[^"]*"$/.test(key) || /^[\w$.]+\.id$/.test(key) || /^(id|\w+Id)$/.test(key);

describe("keys in src", () => {
  it("are found at all", () => {
    expect(FILES.flatMap((f) => keysOf(f.text)).length).toBeGreaterThan(10);
  });

  it("are ids from the content or a static table, never an index, a coordinate or a display string", () => {
    const offenders = FILES.flatMap(({ file, text }) => {
      if (ORNAMENTS.has(file)) return [];
      const allowed = [...(KEY_EXCEPTIONS[file] ?? [])];
      return keysOf(text).flatMap((key) => {
        if (isIdKey(key)) return [];
        const at = allowed.indexOf(key);
        if (at >= 0) {
          allowed.splice(at, 1);
          return [];
        }
        return [`${file} key={${key}}`];
      });
    });
    expect(offenders).toEqual([]);
  });

  it("keep every documented exception in use", () => {
    const stale = Object.entries(KEY_EXCEPTIONS).flatMap(([file, keys]) => {
      const source = FILES.find((f) => f.file === file);
      const present = source ? keysOf(source.text) : [];
      return keys.flatMap((key) => (present.includes(key) ? [] : [`${file} key={${key}}`]));
    });
    expect(stale).toEqual([]);
  });
});

describe("types in src", () => {
  it("assert no non-null: `x!.y`, `x!;`, `f(x!)`, `x![i]` (the intro waits for #124)", () => {
    expect(matches(/[\w)\]]!(?=[.;,)[])/, (file) => INTRO.test(file))).toEqual([]);
  });

  it("cast no DOM query: no `querySelector<…>`, no `as HTMLElement` / `as SVG…Element` (the intro waits for #124)", () => {
    expect(matches(/querySelector(All)?</, (file) => INTRO.test(file))).toEqual([]);
    expect(matches(/\bas (HTML|SVG)\w*Element\b|\bas Element\b|\bas Node\b/)).toEqual([]);
  });

  it("cast no host object: `as unknown as`, `as Navigator`, `as Window`, `globalThis as`, `window as`", () => {
    expect(matches(/\bas unknown as\b|\bas Navigator\b|\bas Window\b|\bglobalThis as\b|\bwindow as\b|\bnavigator as\b/)).toEqual([]);
  });

  it("name every React type by an explicit import: no `React.` namespace", () => {
    expect(matches(/\bReact\.[A-Z]\w*/)).toEqual([]);
  });

  it("take useId as React 19 gives it: no sanitised `useId().replace`", () => {
    expect(matches(/useId\(\)\s*\.\s*replace/)).toEqual([]);
  });

  it("declare no single-valued string union", () => {
    expect(matches(/^\s*(export )?type \w+ = (["'])[^"'|]*\2;?\s*$/)).toEqual([]);
  });

  it("give no type and component one name in one module", () => {
    const offenders = FILES.flatMap(({ file, text }) => {
      const types = new Set([...text.matchAll(/^(?:export )?(?:type|interface) (\w+)/gm)].map((m) => m[1]));
      const components = [
        ...[...text.matchAll(/^(?:export )?(?:default )?function ([A-Z]\w*)/gm)].map((m) => m[1]),
        ...[...text.matchAll(/^import ([A-Z]\w*)(?:,| from)/gm)].map((m) => m[1]),
        ...[...text.matchAll(/^import \{([^}]*)\}/gm)].flatMap((m) =>
          m[1]
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s && !s.startsWith("type ") && !s.includes(" as "))
            .filter((s) => /^[A-Z]/.test(s)),
        ),
      ];
      return components.flatMap((name) => (types.has(name) ? [`${file} ${name}`] : []));
    });
    expect(offenders).toEqual([]);
  });

  it("take a section id as SectionId, never string", () => {
    // where section ids flow: the marks' and the engine's tables name their own parts
    const SECTIONS = /^(app|content|features|scroll|state)\//;
    const offenders = matches(/\b(id|sectionId|section)\??: string\b/, (file) => !SECTIONS.test(file));
    expect(offenders).toEqual([]);
    // the marks' tables name their own parts by string ids
    expect(matches(/\bid: string\b/)).toHaveLength(2);
  });
});
