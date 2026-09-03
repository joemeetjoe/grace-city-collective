import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A textual lint over src for the modules, exports and naming sweep (#128):
 * what the audit found is fixed, and a new instance is a regression. It
 * reads text, not the module graph, so each rule is a pattern with the
 * exceptions it cannot see past written out here, and a stale exception
 * fails too.
 *
 * Out of its sight: features/intro (#124 rewrites it — its react-hooks
 * disables and its orphaned JSDoc wait for that; lift INTRO once it has
 * landed).
 */

const SRC = resolve(__dirname, "..");
const ROOT = resolve(SRC, "..");

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

/**
 * The #134 react-three-fiber spike. It is measured, not shipped — the
 * default build drops it and the recommendation is no-go — and it was
 * written before these conventions existed. If the migration is ever taken,
 * lift this and hold its files to the same rules as the rest.
 */
const FIBER = /^engine\/fiber\//;

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

/** the `from "…"` specifiers of a file's imports and re-exports */
function specifiers(text: string): string[] {
  return [...text.matchAll(/\bfrom\s+["']([^"']+)["']/g)].map((m) => m[1]);
}

/**
 * The Node-safe graph: what vite.config.ts reaches by relative import at
 * build, loaded under the node tsconfig where the `@/` alias does not
 * resolve. These files keep relative imports, however deep; every other
 * file names a module outside its own folder by the alias.
 */
function nodeSafe(): Set<string> {
  const seen = new Set<string>();
  const walk = (path: string) => {
    if (seen.has(path)) return;
    seen.add(path);
    for (const spec of specifiers(readFileSync(path, "utf8"))) {
      if (!spec.startsWith(".")) continue;
      const base = resolve(dirname(path), spec);
      const found = ["", ".ts", ".tsx"].map((ext) => base + ext).find((p) => existsSync(p) && statSync(p).isFile());
      if (found && /\.tsx?$/.test(found)) walk(found);
    }
  };
  walk(resolve(ROOT, "vite.config.ts"));
  seen.delete(resolve(ROOT, "vite.config.ts"));
  return new Set([...seen].map((p) => relative(SRC, p)));
}

const NODE_SAFE = nodeSafe();

describe("imports in src", () => {
  it("find the Node-safe graph from vite.config.ts", () => {
    for (const file of [
      "features/intro/staticSplash.ts",
      "features/stops/heroMetrics.ts",
      "device/tierPolicy.ts",
      "theme/measures.ts",
      "content/surfaces.ts",
    ]) {
      expect(NODE_SAFE, file).toContain(file);
    }
    expect(NODE_SAFE).not.toContain("app/App.tsx");
  });

  it("stay relative in the Node-safe graph: the node tsconfig has no alias", () => {
    const offenders = FILES.flatMap(({ file, text }) =>
      NODE_SAFE.has(file) ? specifiers(text).flatMap((s) => (s.startsWith("@/") ? [`${file} ${s}`] : [])) : [],
    );
    expect(offenders).toEqual([]);
  });

  it("use the @/ alias everywhere else: no `../../` outside the Node-safe graph", () => {
    const offenders = FILES.flatMap(({ file, text }) =>
      NODE_SAFE.has(file) ? [] : specifiers(text).flatMap((s) => (s.startsWith("../../") ? [`${file} ${s}`] : [])),
    );
    expect(offenders).toEqual([]);
  });
});

describe("exports in src", () => {
  /** an export a component file may carry: a component, or a type */
  const COMPONENT_EXPORT =
    /^export (default )?function [A-Z]\w*|^export default class [A-Z]\w*|^export type |^export interface |^export default (memo|forwardRef|lazy)\([A-Z]\w*\);?$|^export const [A-Z]\w* = (memo|forwardRef|lazy)\(/;

  it("in a .tsx are components and types only: constants and helpers live in sibling .ts modules", () => {
    const offenders = FILES.flatMap(({ file, lines }) =>
      file.endsWith(".tsx")
        ? lines.flatMap((line, i) =>
            /^export /.test(line) && !COMPONENT_EXPORT.test(line) ? [`${file}:${i + 1} ${line.trim()}`] : [],
          )
        : [],
    );
    expect(offenders).toEqual([]);
  });

  it("make a context in a .ts, beside its hook, never in the provider's .tsx", () => {
    expect(matches(/\bcreateContext[<(]/, (file) => !file.endsWith(".tsx"))).toEqual([]);
  });

  it("carry no eslint-disable: react-refresh has nothing to say once a .tsx exports components only (the intro waits for #124, the spike is exempt)", () => {
    const offenders = FILES.flatMap(({ file, lines }) =>
      INTRO.test(file) || FIBER.test(file)
        ? []
        : lines.flatMap((line, i) => (/eslint-disable/.test(line) ? [`${file}:${i + 1}`] : [])),
    );
    expect(offenders).toEqual([]);
  });

  it("name every hook file after its one hook: `useX.ts` exports `useX`", () => {
    // the store's bound hook is zustand's `create()` return, in the store module
    const EXCEPTIONS = new Set(["state/appStore.ts"]);
    const offenders = FILES.flatMap(({ file, text }) => {
      const hooks = [...text.matchAll(/^export (?:function|const) (use[A-Z]\w*)/gm)].map((m) => m[1]);
      if (hooks.length === 0 || EXCEPTIONS.has(file) || FIBER.test(file)) return [];
      const name = file.replace(/^.*\//, "").replace(/\.tsx?$/, "");
      return hooks.length === 1 && hooks[0] === name ? [] : [`${file} exports ${hooks.join(", ")}`];
    });
    expect(offenders).toEqual([]);
    for (const file of EXCEPTIONS) expect(FILES.map((f) => f.file)).toContain(file);
  });

  it("give no two modules one exported value name: what means a different thing in another file is named apart", () => {
    // the intro's handoff names the nav mark's element by the same word the theme names its classes (#124)
    const EXCEPTIONS = new Set(["navMark"]);
    const byName = new Map<string, string[]>();
    for (const { file, text } of FILES) {
      for (const m of text.matchAll(/^export (?:const|let|function|async function) (\w+)/gm)) {
        byName.set(m[1], [...(byName.get(m[1]) ?? []), file]);
      }
    }
    const shared = [...byName].filter(([name, files]) => files.length > 1 && !EXCEPTIONS.has(name));
    expect(shared.map(([name, files]) => `${name}: ${files.join(", ")}`)).toEqual([]);
    for (const name of EXCEPTIONS) expect(byName.get(name)?.length ?? 0, name).toBeGreaterThan(1);
  });

  it("keep the two jump modules one: app/jump.ts owns the DOM primitive and the composition", () => {
    const files = FILES.map((f) => f.file);
    expect(files).not.toContain("scroll/jump.ts");
    expect(files).toContain("app/jump.ts");
    const jump = FILES.find((f) => f.file === "app/jump.ts")!.text;
    expect(jump).toMatch(/^export function jumpTo\(/m);
    expect(jump).toMatch(/^export function createJump\(/m);
  });

  it("keep the moved modules where they went", () => {
    const files = FILES.map((f) => f.file);
    for (const gone of [
      "app/jumpContext.tsx",
      "content/siteContext.tsx",
      "layout/breakpoint.ts",
      "layout/viewportHeight.ts",
    ]) {
      expect(files).not.toContain(gone);
    }
    for (const here of [
      "app/jumpContext.ts",
      "app/JumpProvider.tsx",
      "app/useJump.ts",
      "content/siteContext.ts",
      "content/SiteProvider.tsx",
      "ui/panel/panelShown.ts",
      "ui/panel/usePanelShown.ts",
      "ui/watch.ts",
      "ui/useWatch.ts",
      "layout/useBelowLg.ts",
      "layout/useViewportHeight.ts",
      "features/stops/houseTableMetrics.ts",
      "features/stops/sharedLifeMetrics.ts",
      "features/stops/gatheringCalendarMetrics.ts",
      "features/nav/mobileNavLabels.ts",
      "features/longform/splitRefs.ts",
    ]) {
      expect(files).toContain(here);
    }
  });
});

describe("comments in src", () => {
  it("leave no one-line JSDoc orphaned over a blank line, a module's header aside (the intro waits for #124)", () => {
    // a declaration: what a JSDoc documents; a one-liner over a blank line before any is the module's header
    const DECLARATION = /^(export |const |let |function |type |interface |class |enum )/;
    const offenders = FILES.flatMap(({ file, lines }) => {
      if (INTRO.test(file)) return [];
      const firstDeclaration = lines.findIndex((line) => DECLARATION.test(line));
      return lines.flatMap((line, i) =>
        i > firstDeclaration && /^\s*\/\*\*.*\*\/\s*$/.test(line) && (lines[i + 1] ?? "").trim() === ""
          ? [`${file}:${i + 1} ${line.trim()}`]
          : [],
      );
    });
    expect(offenders).toEqual([]);
  });

  it("point at no issue as a consumer: `consumed by #NN`, `see #NN`", () => {
    expect(
      FILES.flatMap(({ file, lines }) =>
        lines.flatMap((line, i) => (/\b(consumed by|see) #\d+/.test(line) ? [`${file}:${i + 1} ${line.trim()}`] : [])),
      ),
    ).toEqual([]);
  });
});
