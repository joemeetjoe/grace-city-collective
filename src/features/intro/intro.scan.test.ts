import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A lint over the intro's sources (#124): every element the intro moves
 * comes in as a ref or off the reveal registry (state/revealTargets.ts), so
 * no module here may query the document; the intro's effects are the
 * controller's now, so no hook here needs an eslint escape; the session flag
 * is read once and written once through introPolicy.ts; and the static
 * splash leaves the page in one place. The one lookup that stays is inside
 * the adopted static root, by the hooks the build stamped on it
 * (IntroSplash.tsx, staticSplashDom.ts): that markup is HTML, not rendered,
 * so nothing could have handed its parts over as refs.
 */

const DIR = __dirname;

/** every source file in the intro, tests aside */
const sources = readdirSync(DIR).filter((name) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name));
const text = Object.fromEntries(sources.map((name) => [name, readFileSync(join(DIR, name), "utf8")]));

/** the files whose text matches */
function where(re: RegExp): string[] {
  return sources.filter((name) => re.test(text[name]));
}

/** how many times the text matches, over every file but `except` */
function count(re: RegExp, except: string): number {
  return sources.filter((name) => name !== except).reduce((n, name) => n + (text[name].match(re)?.length ?? 0), 0);
}

describe("the intro's sources", () => {
  it("are found at all", () => {
    expect(sources).toContain("introMachine.ts");
    expect(sources.length).toBeGreaterThan(10);
  });

  it("query nothing off the document: every target is a ref or a registered element", () => {
    // staticSplash.ts is the text of the inline script that drops the static splash before the bundle runs, not code that runs here
    expect(where(/\bdocument\.(querySelector(All)?|getElementById|getElementsBy\w+)\(/).filter((name) => name !== "staticSplash.ts")).toEqual([]);
  });

  it("need no eslint escape", () => {
    expect(where(/eslint-disable/)).toEqual([]);
  });

  it("keep the session flag behind introPolicy.ts: written in one place, read by the app's init and mirrored by the inline script alone", () => {
    // the storage itself: the policy, its key, and the static splash's inline script (which runs before the bundle can)
    expect(where(/sessionStorage/)).toEqual(["introKeys.ts", "introPolicy.ts", "staticSplash.ts"]);
    expect(where(/\bmarkIntroPlayed\(/)).toEqual(["introMachine.ts", "introPolicy.ts"]);
    expect(count(/\bmarkIntroPlayed\(/g, "introPolicy.ts")).toBe(1);
    // the read is the app's, at init (app/initApp.ts): nothing in the intro reads the flag back
    expect(count(/\breadIntroPlayed\(|\breadPolicyInputs\(/g, "introPolicy.ts")).toBe(0);
  });

  it("take the static splash out of the page in exactly one place", () => {
    expect(where(/\bremoveStaticSplash\(/)).toEqual(["staticSplashDom.ts", "useIntroReveals.ts"]);
    expect(count(/\bremoveStaticSplash\(/g, "staticSplashDom.ts")).toBe(1);
  });
});
