import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A best-effort lint over src for two effect smells (#118): a ref object in
 * an effect's dependency array, and a state setter called from an effect's
 * cleanup. Both belong to the hooks under src/ui (useInView, useMeasure,
 * watch.ts) now, so a new instance is a regression.
 *
 * What it can and cannot see — it reads text, not types:
 * - only calls literally written `useEffect(` / `useLayoutEffect(`, the
 *   dependency array being the call's last top-level `[...]` argument;
 * - a ref is an identifier named `ref` or ending in `Ref` — a ref object
 *   passed under another name (a hook's `wrapper`, `parallax`) passes;
 * - a setter is a call named `set<Capital>…(` inside the cleanup — the
 *   cleanup being the `return () => …` (block or expression) directly in
 *   the effect's body; a setter under another name, or reached through a
 *   helper, passes, as does an effect written `() => () => …` with no
 *   `return`, and a store action named `setX` is flagged too;
 * - strings and comments are skipped when matching parentheses, but
 *   template literals' `${}` are not understood, so an effect that holds
 *   one with unbalanced parens may be cut short.
 */

const SRC = __dirname;

/** every source file under src, tests and the test setup aside */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "test" ? [] : sources(path);
    if (!/\.tsx?$/.test(name) || /\.test\.tsx?$/.test(name) || name.endsWith(".d.ts")) return [];
    return [path];
  });
}

type EffectCall = { file: string; line: number; text: string };

/** the text of each effect call, from the hook's name to its matching close paren */
function effectCalls(file: string, source: string): EffectCall[] {
  const calls: EffectCall[] = [];
  const re = /\buse(?:Layout)?Effect\(/g;
  for (let m = re.exec(source); m; m = re.exec(source)) {
    const start = m.index;
    let i = start + m[0].length;
    let depth = 1;
    while (i < source.length && depth > 0) {
      const ch = source[i];
      const two = source.slice(i, i + 2);
      if (two === "//") i = source.indexOf("\n", i);
      else if (two === "/*") i = source.indexOf("*/", i) + 2;
      else if (ch === '"' || ch === "'" || ch === "`") {
        let j = i + 1;
        while (j < source.length && source[j] !== ch) j += source[j] === "\\" ? 2 : 1;
        i = j + 1;
      } else {
        if (ch === "(") depth += 1;
        else if (ch === ")") depth -= 1;
        i += 1;
      }
      if (i < 0) break;
    }
    calls.push({
      file: relative(SRC, file),
      line: source.slice(0, start).split("\n").length,
      text: source.slice(start, i),
    });
  }
  return calls;
}

/** the dependency array's contents, when the call ends in one */
function depsOf(call: string): string | null {
  const m = /,\s*\[([^\]]*)\]\s*\)$/.exec(call);
  return m ? m[1] : null;
}

/** the cleanup's text: the `return () => …` directly in the effect's body */
function cleanupOf(call: string): string | null {
  const m = /return\s*\(\)\s*=>\s*/.exec(call);
  if (!m) return null;
  const from = m.index + m[0].length;
  if (call[from] !== "{") return call.slice(from, call.indexOf("\n", from));
  let depth = 0;
  for (let i = from; i < call.length; i += 1) {
    if (call[i] === "{") depth += 1;
    else if (call[i] === "}") {
      depth -= 1;
      if (depth === 0) return call.slice(from, i + 1);
    }
  }
  return call.slice(from);
}

const calls = sources(SRC).flatMap((file) => effectCalls(file, readFileSync(file, "utf8")));

describe("effects in src", () => {
  it("are found at all", () => {
    expect(calls.length).toBeGreaterThan(5);
  });

  it("list no ref object in a dependency array", () => {
    const offenders = calls.flatMap(({ file, line, text }) => {
      const deps = depsOf(text);
      if (!deps) return [];
      const refs = deps
        .split(",")
        .map((d) => d.trim())
        .filter((d) => /^(ref|\w+Ref)$/.test(d));
      return refs.length ? [`${file}:${line} [${refs.join(", ")}]`] : [];
    });
    expect(offenders).toEqual([]);
  });

  it("call no state setter from a cleanup", () => {
    const offenders = calls.flatMap(({ file, line, text }) => {
      const cleanup = cleanupOf(text);
      const setters = cleanup?.match(/\bset[A-Z]\w*\(/g);
      return setters ? [`${file}:${line} ${setters.join(" ")}`] : [];
    });
    expect(offenders).toEqual([]);
  });
});
