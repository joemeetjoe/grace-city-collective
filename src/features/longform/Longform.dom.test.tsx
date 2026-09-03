import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { site } from "@/content/site";
import Longform from "./Longform";

/**
 * The four parts and the footer as they rendered before the section scaffold
 * (#122), serialised from jsdom by `serialise` below at the last commit
 * before it.
 */
// jsdom gives import.meta.url an http scheme, so the files are found from the repo root
const DIR = join(process.cwd(), "src/features/longform");
const PINNED = readFileSync(join(DIR, "__fixtures__/longform.dom.html"), "utf8");

/** the long-form components' sources: every list they render is keyed by its item's id */
const COMPONENTS = ["Devotions", "Beliefs", "Faq", "Messages", "SiteFooter"];

/**
 * innerHTML with every text node marked off by an empty comment, so two
 * adjacent text nodes never read as one: where a line is split differently
 * between JSX and content, Chrome shapes the runs apart and the pixels move.
 */
function serialise(root: HTMLElement): string {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const texts: Node[] = [];
  while (walker.nextNode()) texts.push(walker.currentNode);
  for (const t of texts) t.parentNode!.insertBefore(document.createComment(""), t);
  return root.innerHTML;
}

describe("the long-form DOM", () => {
  it("is node for node what it was before the scaffold: the same markup, attributes, words and text runs", () => {
    const { container } = render(
      <>
        {site.longform.map((s) => (
          <section key={s.id} id={s.id}>
            <Longform part={s.id} />
          </section>
        ))}
        <Longform part="footer" />
      </>,
    );
    expect(serialise(container)).toBe(PINNED);
  });

  it("keys every list item by its content id, never by a title, a ref, an href or an index", () => {
    for (const name of COMPONENTS) {
      const source = readFileSync(join(DIR, `${name}.tsx`), "utf8");
      const keys = [...source.matchAll(/key=\{([^}]*)\}/g)].map((m) => m[1]);
      expect(keys.length, `${name}.tsx renders a keyed list`).toBeGreaterThan(0);
      for (const key of keys) expect(key, `${name}.tsx key={${key}}`).toMatch(/^\w+\.id$/);
    }
  });
});
