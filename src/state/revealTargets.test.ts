import { afterEach, describe, expect, it } from "vitest";

import { registerRevealTarget, revealRef, revealTargets } from "./revealTargets";

const unregister: (() => void)[] = [];
const register = (kind: Parameters<typeof registerRevealTarget>[0], el: Element) => {
  unregister.push(registerRevealTarget(kind, el));
};

afterEach(() => {
  for (const off of unregister.splice(0)) off();
  document.body.innerHTML = "";
});

describe("revealTargets", () => {
  it("hands back the targets of a kind in document order, whatever order they registered in", () => {
    document.body.innerHTML = `<a id="a"></a><a id="b"></a><a id="c"></a>`;
    const [a, b, c] = Array.from(document.body.children);
    register("link", c);
    register("link", a);
    register("link", b);
    expect(revealTargets("link").map((el) => el.id)).toEqual(["a", "b", "c"]);
    expect(revealTargets("dot")).toEqual([]);
  });

  it("keeps the kinds apart and forgets an element once its unregister is called", () => {
    document.body.innerHTML = `<a id="a"></a><span id="g"></span>`;
    const [a, g] = Array.from(document.body.children);
    const off = registerRevealTarget("link", a);
    register("glass", g);
    expect(revealTargets("link")).toEqual([a]);
    expect(revealTargets("glass")).toEqual([g]);
    off();
    expect(revealTargets("link")).toEqual([]);
    expect(revealTargets("glass")).toEqual([g]);
  });

  it("registers an element once, however many times it is given", () => {
    document.body.innerHTML = `<a id="a"></a>`;
    const a = document.body.firstElementChild!;
    register("dot", a);
    register("dot", a);
    expect(revealTargets("dot")).toEqual([a]);
  });
});

describe("revealRef", () => {
  it("is one ref callback per kind that registers the element and returns its unregister", () => {
    expect(revealRef("mark")).toBe(revealRef("mark"));
    expect(revealRef("mark")).not.toBe(revealRef("link"));
    document.body.innerHTML = `<a id="m"></a>`;
    const m = document.body.firstElementChild!;
    const off = revealRef("mark")(m);
    expect(revealTargets("mark")).toEqual([m]);
    off!();
    expect(revealTargets("mark")).toEqual([]);
    // React <19 style: a null hands nothing back and registers nothing
    expect(revealRef("mark")(null)).toBeUndefined();
    expect(revealTargets("mark")).toEqual([]);
  });
});
