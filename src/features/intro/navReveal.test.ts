import { afterEach, describe, expect, it } from "vitest";

import { gsap } from "@/lib/gsap";
import { registerRevealTarget, type RevealKind } from "@/state/revealTargets";
import { NAV_REVEAL_SECONDS, NAV_REVEAL_STAGGER } from "@/theme/motion";
import { NAV_REVEAL_DROP, NAV_REVEAL_SLIDE, buildNavReveal, collectNavReveal } from "./navReveal";

const unregister: (() => void)[] = [];

/** the desktop nav and the dot rail, as App.tsx lays them out and the nav registers them */
function stage(): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = `
    <nav>
      <div>
        <a id="give" data-kind="action">Give</a>
        <a id="join" data-kind="action">Join Sunday</a>
      </div>
      <div id="pill" data-kind="glass">
        <a id="l1" data-kind="link">One</a>
        <a id="l2" data-kind="link">Two</a>
        <a id="l3" data-kind="link">Three</a>
      </div>
      <a id="mark" data-kind="mark">mark</a>
    </nav>
    <nav>
      <span id="strip" data-kind="glass"></span>
      <a id="d1" data-kind="dot"></a>
      <a id="d2" data-kind="dot"></a>
    </nav>`;
  document.body.appendChild(root);
  for (const el of root.querySelectorAll<HTMLElement>("[data-kind]")) {
    unregister.push(registerRevealTarget(el.dataset.kind as RevealKind, el));
  }
  return root;
}

const ids = (els: Element[]) => els.map((el) => el.id);

afterEach(() => {
  for (const off of unregister.splice(0)) off();
  document.body.innerHTML = "";
});

describe("collectNavReveal", () => {
  it("reads the links and the calls to action from the mark outward, the dots top down, and every glass", () => {
    stage();
    const targets = collectNavReveal();
    expect(ids(targets.links)).toEqual(["l3", "l2", "l1"]);
    expect(ids(targets.actions)).toEqual(["join", "give"]);
    expect(ids(targets.dots)).toEqual(["d1", "d2"]);
    expect(ids(targets.glass)).toEqual(["pill", "strip"]);
  });

  it("leaves the mark alone: the handoff lands it", () => {
    stage();
    const targets = collectNavReveal();
    const all = [...targets.links, ...targets.actions, ...targets.dots, ...targets.glass];
    expect(all.find((el) => el.id === "mark")).toBeUndefined();
  });

  it("finds nothing once the nav has unregistered", () => {
    stage();
    for (const off of unregister.splice(0)) off();
    expect(collectNavReveal()).toEqual({ links: [], actions: [], dots: [], glass: [] });
  });
});

describe("buildNavReveal", () => {
  it("drops the links in one by one from the mark, then the actions, and slides the dots in from the edge", () => {
    const root = stage();
    const targets = collectNavReveal();
    const tl = buildNavReveal(targets);
    tl.pause(0);
    const at = (id: string) => root.querySelector<HTMLElement>(`#${id}`)!;
    // at the start everything waits faded and set off its place
    expect(gsap.getProperty(at("l3"), "opacity")).toBe(0);
    expect(gsap.getProperty(at("l3"), "y")).toBe(-NAV_REVEAL_DROP);
    expect(gsap.getProperty(at("join"), "opacity")).toBe(0);
    expect(gsap.getProperty(at("d1"), "x")).toBe(NAV_REVEAL_SLIDE);
    // the nearest link has moved before the next one, and before the actions
    tl.progress((NAV_REVEAL_STAGGER + 0.02) / tl.duration());
    const nearest = Number(gsap.getProperty(at("l3"), "opacity"));
    const next = Number(gsap.getProperty(at("l2"), "opacity"));
    expect(nearest).toBeGreaterThan(0);
    expect(nearest).toBeGreaterThan(next);
    expect(gsap.getProperty(at("join"), "opacity")).toBe(0);
    // the whole cascade takes about a second and a half
    expect(tl.duration()).toBeGreaterThan(NAV_REVEAL_SECONDS);
    // and hands every style back to CSS at the end
    tl.progress(1);
    for (const id of ["l1", "l2", "l3", "give", "join", "d1", "d2"]) {
      expect(at(id).style.opacity).toBe("");
      expect(at(id).style.transform).toBe("");
    }
    expect(at("pill").style.backgroundColor).toBe("");
    expect(at("strip").style.borderColor).toBe("");
    tl.kill();
  });

  it("builds an empty timeline for a page with none of the pieces (below the desktop breakpoint)", () => {
    const tl = buildNavReveal({ links: [], actions: [], dots: [], glass: [] });
    expect(tl.duration()).toBe(0);
    tl.kill();
  });
});
