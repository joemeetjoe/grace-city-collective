import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A lint over src for `prefers-reduced-motion` (#132): the query's string
 * is defined once (device/reducedMotion.ts) and read at runtime in one
 * module (state/syncReducedMotion.ts) — the mount's initial value and the
 * live subscription that keeps the store's `reducedMotion` current. Every
 * consumer reads the store. The exceptions are compile-time: the inline
 * head scripts that the build emits as text into index.html, which the
 * browser runs before the bundle can (features/intro/staticSplash.ts drops
 * the static splash, device/enginePreload.ts guards the preloads) — they
 * carry the query inside a string literal and call nothing here — and the
 * stylesheet, which follows the media query natively (index.css, and the
 * `motion-safe:` utilities over it).
 */

const SRC = join(__dirname, "..");

/** every source file under src, tests and the test setup aside */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "test" ? [] : sources(path);
    if (!/\.(tsx?|css)$/.test(name) || /\.test\.tsx?$/.test(name) || name.endsWith(".d.ts")) return [];
    return [path];
  });
}

const files = sources(SRC).map((path) => ({ path: relative(SRC, path), text: readFileSync(path, "utf8") }));

/** the files whose text matches */
const where = (re: RegExp) => files.filter(({ text }) => re.test(text)).map(({ path }) => path).sort();

/** the runtime module that reads the media query */
const READER = "state/syncReducedMotion.ts";
/** the build-time head scripts: the query as text inside a string literal */
const HEAD_SCRIPTS = ["device/enginePreload.ts", "features/intro/staticSplash.ts"];

describe("prefers-reduced-motion is read in one place", () => {
  it("scans the sources at all", () => {
    expect(files.map((f) => f.path)).toContain(READER);
    expect(files.length).toBeGreaterThan(100);
  });

  it("the query's string is written once, in device/reducedMotion.ts; the stylesheet follows it natively", () => {
    expect(where(/["'`]\(prefers-reduced-motion/)).toEqual(["device/reducedMotion.ts"]);
    expect(where(/@media \(prefers-reduced-motion/)).toEqual(["index.css"]);
  });

  it("the constant is read by the runtime reader and the two head scripts alone", () => {
    expect(where(/\bREDUCED_MOTION_QUERY\b/)).toEqual(["device/reducedMotion.ts", ...HEAD_SCRIPTS, READER].sort());
  });

  it("matchMedia is called with it in the runtime reader alone; the head scripts carry the call as text", () => {
    const calls = where(/matchMedia\(\s*REDUCED_MOTION_QUERY\s*\)/);
    expect(calls).toEqual([READER]);
    for (const path of HEAD_SCRIPTS) {
      const { text } = files.find((f) => f.path === path)!;
      // the query reaches the script through JSON.stringify, inside the script's own string
      expect(text).toMatch(/matchMedia\(\$\{JSON\.stringify\(REDUCED_MOTION_QUERY\)\}\)/);
    }
  });

  it("no consumer asks the browser; each reads the store", () => {
    // the other media queries the page keeps live (the tier's width line, the lg breakpoint) stay theirs
    const others = where(/\bmatchMedia\b/).filter((path) => path !== READER && !HEAD_SCRIPTS.includes(path));
    expect(others).toEqual(["device/deviceProfile.ts", "layout/breakpoint.ts"]);
  });
});
