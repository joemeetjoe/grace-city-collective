import { render } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

import Seal from "@/components/Seal";
import { baseMarkup } from "@/test/sealMarkup";

import { STAMP_SECONDS, stampTween } from "./sealStamp";

/** hidden by an inline style or visibility attribute on the element or any ancestor (jsdom has no layout) */
function hidden(el: Element | null): boolean {
  for (let node: Element | null = el; node && node.tagName !== "svg"; node = node.parentElement) {
    const style = (node as HTMLElement).style;
    if (style.visibility === "hidden" || style.display === "none" || style.opacity === "0") return true;
    if (node.getAttribute("visibility") === "hidden" && style.visibility === "") return true;
  }
  return false;
}

const part = (seal: Element, name: string) => seal.querySelector(`[data-seal="${name}"]`);

function liveSeal(atRest = false): SVGSVGElement {
  const { container } = render(createElement(Seal, { variant: "live", size: 180, atRest }));
  return container.querySelector("svg")!;
}

describe("stampTween", () => {
  it("runs ~0.5s with the live overlay on, then puts it back to rest and clears what it touched", () => {
    const seal = liveSeal(true);
    const onLive = vi.fn();
    const tl = stampTween(seal, { onLive }).pause();
    expect(STAMP_SECONDS).toBeCloseTo(0.5, 1);
    expect(tl.duration()).toBeCloseTo(STAMP_SECONDS, 3);

    tl.progress(0.3);
    expect(onLive).toHaveBeenLastCalledWith(true);
    expect(hidden(part(seal, "live"))).toBe(false);
    expect(seal.style.transform).not.toBe("");
    expect(hidden(part(seal, "grain"))).toBe(false);

    tl.progress(1);
    expect(onLive).toHaveBeenLastCalledWith(false);
    expect(hidden(part(seal, "live"))).toBe(true);
    expect(seal.style.transform).toBe("");
    expect(hidden(part(seal, "fleur"))).toBe(false);
  });

  it("leaves the same clean end state when run twice back-to-back", () => {
    const seal = liveSeal(true);
    const { container } = render(createElement(Seal, { variant: "static", size: 180 }));
    const still = baseMarkup(container.querySelector("svg")!);
    stampTween(seal).pause().progress(1);
    expect(baseMarkup(seal)).toBe(still);
    const second = stampTween(seal).pause();
    second.progress(0.5);
    expect(hidden(part(seal, "live"))).toBe(false);
    second.progress(1);
    expect(baseMarkup(seal)).toBe(still);
    expect((part(seal, "live") as HTMLElement).style.display).toBe("none");
  });

  it("leaves the overlay showing on a seal that was lit before the stamp", () => {
    const seal = liveSeal();
    stampTween(seal).pause().progress(1);
    expect(hidden(part(seal, "live"))).toBe(false);
  });
});
