/**
 * The long-form chunk (#111): Devotions, Beliefs, FAQ, Messages and the
 * footer leave the shell and arrive through one dynamic import. Read out of
 * Vite's manifest, then checked against the chunks' own source.
 */
import { describe, expect, it } from "vitest";

import { readDist } from "./dist";

/** the module whose dynamic import produces the chunk (src/features/longform/loadLongform.ts) */
const LONGFORM_ENTRY = "src/features/longform/Longform.tsx";

/**
 * Markup only the long-form components carry. Not a heading or a question:
 * src/content/site.ts stays in the shell (the nav, the stops, the noscript
 * surfaces read it), so its words prove nothing about which chunk the
 * components went to. The ScriptureRefs divider's attribute and the Messages
 * heading's "Current series" label live in the components alone.
 */
const LONGFORM_ONLY = ['data-ref-lozenge', "Current series"];

type Chunk = { file: string; isEntry?: boolean; isDynamicEntry?: boolean; dynamicImports?: string[] };
const manifest = JSON.parse(readDist(".vite/manifest.json")) as Record<string, Chunk>;

describe("the long-form chunk", () => {
  const entry = manifest["index.html"];
  const longform = manifest[LONGFORM_ENTRY];

  it("is a dynamic import of the shell, emitted as its own chunk", () => {
    expect(entry?.isEntry).toBe(true);
    expect(entry.dynamicImports).toContain(LONGFORM_ENTRY);
    expect(longform?.isDynamicEntry).toBe(true);
    expect(longform.file).toMatch(/^assets\/Longform-[\w-]+\.js$/);
  });

  it("carries the long-form components, and the shell carries none of them", () => {
    const shell = readDist(entry.file);
    const chunk = readDist(longform.file);
    for (const literal of LONGFORM_ONLY) {
      expect(chunk, literal).toContain(literal);
      expect(shell, literal).not.toContain(literal);
    }
  });
});
