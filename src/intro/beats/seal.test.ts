import { render } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

import Seal from "@/components/Seal";
import { baseMarkup } from "@/test/sealMarkup";
import { introBeats } from "@/intro/beats";
import { INTRO_LABELS, WORDMARK_WIPE_SECONDS, buildIntroTimeline, type IntroTargets } from "@/intro/timeline";

import { SEAL_BEAT_SECONDS, STAMP_SECONDS, sealBeat, stampTween } from "./seal";

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

function targets(atRest = false): IntroTargets & { seal: SVGSVGElement } {
  const wordmark = document.createElement("span");
  wordmark.textContent = "Grace City";
  document.body.append(wordmark);
  const { container } = render(createElement(Seal, { variant: "live", size: 180, atRest }));
  return { wordmark, script: null, seal: container.querySelector("svg")! };
}

describe("sealBeat", () => {
  it("occupies the seal slot: starts at the seal label and runs the intro out to ~3.3s", () => {
    const tl = buildIntroTimeline(targets(), [sealBeat]);
    tl.pause();
    expect(sealBeat.label).toBe("seal");
    expect(tl.labels.seal).toBeCloseTo(INTRO_LABELS.seal, 6);
    expect(SEAL_BEAT_SECONDS).toBeCloseTo(1.4, 1);
    expect(tl.duration()).toBeCloseTo(INTRO_LABELS.seal + SEAL_BEAT_SECONDS, 3);
    expect(tl.duration()).toBeCloseTo(3.3, 1);
  });
});

describe("sealBeat before its slot", () => {
  it("hides the wax and relief and holds the bead above the disc", () => {
    const t = targets();
    const tl = buildIntroTimeline(t, [sealBeat]);
    tl.pause();
    tl.progress(0);
    const { seal } = t;
    expect(hidden(part(seal, "wax"))).toBe(true);
    expect(hidden(part(seal, "fleur"))).toBe(true);
    expect(hidden(part(seal, "band"))).toBe(true);
    expect(hidden(part(seal, "highlight"))).toBe(true);
    expect(hidden(part(seal, "drip"))).toBe(false);
    expect(hidden(part(seal, "live"))).toBe(false);
  });
});

describe("sealBeat at completion", () => {
  it("leaves the lit seal: overlay showing, drip hidden, wax/fleur/band shown, nothing else inline", () => {
    const t = targets();
    const tl = buildIntroTimeline(t, [sealBeat]);
    tl.pause();
    tl.progress(1);
    const { seal } = t;
    // the stamped seal waits on ink looking like wax, not like the flat base
    expect(hidden(part(seal, "live"))).toBe(false);
    expect(hidden(part(seal, "drip"))).toBe(true);
    for (const name of ["wax", "fleur", "band", "highlight"]) {
      expect(hidden(part(seal, name)), name).toBe(false);
      for (let node = part(seal, name); node && node.tagName !== "svg"; node = node.parentElement) {
        expect(node.getAttribute("style") ?? "", name).toBe("");
      }
    }
    expect(seal.style.transform).toBe("");
    expect(seal.style.overflow).toBe("");

    const { container } = render(createElement(Seal, { variant: "static", size: 180 }));
    expect(baseMarkup(seal)).toBe(baseMarkup(container.querySelector("svg")!));
  });
});

describe("stampTween", () => {
  it("runs ~0.5s with the live overlay on, then puts it back to rest and clears what it touched", () => {
    const { seal } = targets(true);
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
    const { seal } = targets(true);
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
    const { seal } = targets();
    stampTween(seal).pause().progress(1);
    expect(hidden(part(seal, "live"))).toBe(false);
  });
});

describe("sealBeat registration", () => {
  it("adds nothing when there is no seal target", () => {
    const tl = buildIntroTimeline({ ...targets(), seal: null }, [sealBeat]);
    tl.pause();
    expect(tl.duration()).toBeCloseTo(WORDMARK_WIPE_SECONDS, 3);
  });

  it("is installed in the intro under the seal label", () => {
    expect(introBeats.filter((b) => b.label === "seal")).toEqual([sealBeat]);
  });
});
