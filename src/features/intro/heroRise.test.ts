import { afterEach, describe, expect, it } from "vitest";

import { gsap } from "@/lib/gsap";
import { HERO_RISE_PX, HERO_SETTLE_PX, riseHeroHeadline } from "./heroRise";

function headline(): HTMLElement {
  const h1 = document.createElement("h1");
  h1.setAttribute("data-hero-headline", "");
  h1.textContent = "A church for the whole city";
  document.body.appendChild(h1);
  return h1;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("riseHeroHeadline", () => {
  it("does nothing without a headline", () => {
    expect(riseHeroHeadline(null)).toBeNull();
    expect(document.querySelector(".hero-line")).toBeNull();
  });

  it("splits the headline into lines that rise into place, then hands their styles back to CSS", () => {
    const h1 = headline();
    const rise = riseHeroHeadline(h1)!;
    expect(rise.lines.length).toBeGreaterThan(0);
    const tween = rise.tween!;
    tween.pause(0);
    // at the start each line waits below its place, faded
    const first = rise.lines[0];
    expect(gsap.getProperty(first, "opacity")).toBe(0);
    expect(gsap.getProperty(first, "y")).toBe(HERO_RISE_PX);
    tween.progress(1);
    expect((first as HTMLElement).style.opacity).toBe("");
    expect((first as HTMLElement).style.transform).toBe("");
    // the words are all still there
    expect(h1.textContent).toBe("A church for the whole city");
    rise.revert();
    // reverted, the headline is its plain self again
    expect(h1.querySelector(".hero-line")).toBeNull();
  });

  it("settles the lines from where the splash's headline was lifted to, never from invisible (#107)", () => {
    const h1 = headline();
    const rise = riseHeroHeadline(h1, 0, "settle")!;
    expect(rise.lines.length).toBeGreaterThan(0);
    const tween = rise.tween!;
    tween.pause(0);
    const first = rise.lines[0];
    // at the start each line is fully there, a few px above its place — the handoff's lift
    expect(gsap.getProperty(first, "opacity")).toBe(1);
    expect(gsap.getProperty(first, "y")).toBe(-HERO_SETTLE_PX);
    tween.progress(1);
    expect((first as HTMLElement).style.opacity).toBe("");
    expect((first as HTMLElement).style.transform).toBe("");
    expect(h1.textContent).toBe("A church for the whole city");
    rise.revert();
  });
});
