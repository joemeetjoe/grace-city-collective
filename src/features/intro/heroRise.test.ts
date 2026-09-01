import { afterEach, describe, expect, it } from "vitest";

import { gsap } from "@/lib/gsap";
import { HERO_HEADLINE, HERO_RISE_PX, riseHeroHeadline } from "./heroRise";

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
    expect(document.querySelector(HERO_HEADLINE)).toBeNull();
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
});
