import { describe, expect, it } from "vitest";

import { createSectionRegistry } from "./sections";

describe("createSectionRegistry", () => {
  it("lists the mounted sections in the order the ids were given, whatever order they mounted in", () => {
    const registry = createSectionRegistry(["hero", "about", "faq"]);
    const about = document.createElement("section");
    const hero = document.createElement("section");
    registry.ref("about")(about);
    registry.ref("hero")(hero);
    expect(registry.sections()).toEqual([
      { id: "hero", el: hero },
      { id: "about", el: about },
    ]);
  });

  it("skips ids with no element on the page, and forgets one that unmounts", () => {
    const registry = createSectionRegistry(["hero", "missing"]);
    const hero = document.createElement("section");
    registry.ref("hero")(hero);
    expect(registry.sections().map((s) => s.id)).toEqual(["hero"]);
    registry.ref("hero")(null);
    expect(registry.sections()).toEqual([]);
  });

  it("hands out the same ref for the same id, so a re-render never re-attaches", () => {
    const registry = createSectionRegistry(["hero"]);
    expect(registry.ref("hero")).toBe(registry.ref("hero"));
    expect(registry.ref("hero")).not.toBe(registry.ref("about"));
  });
});
