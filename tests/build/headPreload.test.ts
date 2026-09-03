import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { AVIF_VERDICT_KEY } from "../../src/device/avif";
import { ENGINE_ENTRY, ENGINE_PRELOAD_ATTR } from "../../src/device/enginePreload";
import { TIER_PRELOAD_ATTR } from "../../src/device/tierPreload";
import { distIndexHtml, distManifest, distPath } from "./dist";
import { headOf, withoutNoscript } from "./splashOrder";

/** the head's script tags in order, each as `{ tag, body }` */
function headScripts(html: string): { tag: string; body: string }[] {
  return Array.from(withoutNoscript(headOf(html)).matchAll(/(<script\b[^>]*>)([\s\S]*?)<\/script>/gi)).map((m) => ({
    tag: m[1],
    body: m[2],
  }));
}

/** the inline head script the build emits (src/device/tierPreload.ts), with where it sits */
function tierScript() {
  const html = distIndexHtml();
  const head = withoutNoscript(headOf(html));
  const scripts = headScripts(html);
  const script = scripts.find((s) => s.body.includes(TIER_PRELOAD_ATTR));
  if (!script) throw new Error("no tier preload script in the head");
  return { html, head, scripts, script, at: head.indexOf(script.tag) };
}

/** every hashed file name the script mentions: `<stem>-<hash>.<ext>` */
const NAMES = /[A-Za-z0-9_.-]+-[A-Za-z0-9_-]{8}\.(?:webp|avif|js)/g;

describe("the inline head script (tier preload, #113)", () => {
  it("is the first script in the head, ahead of Vite's module script and every stylesheet or preload link", () => {
    const { head, scripts, script, at } = tierScript();
    expect(scripts[0]).toBe(script);
    expect(script.tag).toBe("<script>");
    const moduleScript = head.indexOf('<script type="module"');
    const cssLink = head.search(/<link\b[^>]*\srel="(?:stylesheet|preload|modulepreload)"/);
    expect(moduleScript).toBeGreaterThan(at);
    expect(cssLink).toBeGreaterThan(at);
  });

  it("decides the tier and the fallback itself, starts the AVIF probe, and marks what it appends", () => {
    const { script } = tierScript();
    expect(script.body).toContain(`window["${AVIF_VERDICT_KEY}"]`);
    expect(script.body).toContain("prefers-reduced-motion");
    expect(script.body).toContain("saveData");
    expect(script.body).toContain('getContext("webgl2")');
    expect(script.body).toContain("innerWidth<1024");
    expect(script.body).toContain("devicePixelRatio||1)<1.5");
    expect(script.body).toContain(`"${ENGINE_PRELOAD_ATTR}"`);
    expect(script.body).toContain(`"${TIER_PRELOAD_ATTR}"`);
    expect(script.body).toContain('"fetchpriority","high"');
  });

  it("carries both tiers' hashed texture names and the engine chunk, all of them in dist/assets, and nothing else", () => {
    const { script } = tierScript();
    const manifest = distManifest();
    const names = new Set(script.body.match(NAMES) ?? []);
    expect(names.size).toBeGreaterThan(100);
    for (const name of names) expect(existsSync(distPath(path.join("assets", name))), name).toBe(true);

    const tierFiles = (width: string) =>
      Object.entries(manifest)
        .filter(([src]) => src.startsWith(`src/assets/dore/${width}/`) && /\.(webp|avif)$/.test(src))
        .map(([, e]) => path.basename(e.file));
    const desktop = tierFiles("2048");
    const mobile = tierFiles("1024");
    expect(desktop.length).toBeGreaterThan(50);
    expect(mobile.length).toBe(desktop.length);
    for (const name of [...desktop, ...mobile]) expect(names.has(name), name).toBe(true);

    // the manifest keys sources without the leading slash the dynamic import carries
    const engine = path.basename(manifest[ENGINE_ENTRY.replace(/^\//, "")].file);
    expect(names.has(engine)).toBe(true);
    const others = [...names].filter((n) => !desktop.includes(n) && !mobile.includes(n) && n !== engine);
    expect(others).toEqual([]);
  });

  it("names each file once under the one assets prefix rather than a url per texture", () => {
    const { script } = tierScript();
    expect(script.body).toContain('"d":"/assets/"');
    expect(script.body.split("/assets/").length - 1).toBe(2);
  });
});
