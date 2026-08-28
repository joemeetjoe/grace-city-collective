import { render } from "@testing-library/react";
import { createElement } from "react";
import { beforeAll, describe, expect, it } from "vitest";

import CollectiveScript from "@/components/CollectiveScript";
import { COLLECTIVE_STROKE } from "@/components/collectiveScriptMetrics";
import { introBeats } from "@/intro/beats";
import { INTRO_LABELS, buildIntroTimeline, type IntroTargets } from "@/intro/timeline";

import { COLLECTIVE_DRAW_SECONDS, collectiveBeat } from "./collective";

// jsdom has no SVG geometry; DrawSVG measures the path with these.
beforeAll(() => {
  const proto = SVGElement.prototype as unknown as Record<string, unknown>;
  proto.getTotalLength = () => 1000;
  proto.getBBox = () => ({ x: 0, y: 0, width: 899, height: 216 });
  proto.getComputedTextLength = () => 0;
});

function mount() {
  const wordmark = document.createElement("span");
  wordmark.textContent = "Grace City";
  document.body.append(wordmark);
  const { container } = render(createElement(CollectiveScript));
  const script = container.querySelector("svg") as SVGSVGElement;
  const path = script.querySelector<SVGPathElement>('[data-script="collective"]')!;
  const targets: IntroTargets = { wordmark, script, seal: null };
  const tl = buildIntroTimeline(targets, [collectiveBeat]);
  tl.pause();
  return { tl, path };
}

describe("collectiveBeat", () => {
  it("keeps the script invisible until the wordmark wipe has finished", () => {
    const { tl, path } = mount();
    tl.progress(0);
    expect(path.style.visibility).toBe("hidden");
    tl.time(0.5);
    expect(path.style.visibility).toBe("hidden");
  });

  it("draws the script inside its slot: from the collective label to ~1.9s", () => {
    const { tl, path } = mount();
    expect(COLLECTIVE_DRAW_SECONDS).toBeCloseTo(1.2, 1);
    const draws = tl.getChildren(true, true, false).filter((t) => t.targets().includes(path) && t.duration() > 0);
    expect(draws.length).toBeGreaterThan(0);
    expect(Math.min(...draws.map((t) => t.startTime()))).toBeCloseTo(tl.labels.collective, 6);
    expect(tl.duration()).toBeCloseTo(INTRO_LABELS.collective + COLLECTIVE_DRAW_SECONDS, 6);
    expect(tl.duration()).toBeCloseTo(INTRO_LABELS.seal, 1);
    tl.time(0.7);
    expect(path.style.visibility).not.toBe("hidden");
  });

  it("ends pixel-identical to the static script: no inline dash styling, stroke width untouched", () => {
    const { tl, path } = mount();
    tl.time(1.2);
    expect(path.style.strokeDasharray).not.toBe("");
    tl.progress(1);
    expect(path.style.strokeDasharray).toBe("");
    expect(path.style.strokeDashoffset).toBe("");
    expect(path.style.visibility).toBe("");
    expect(path.style.strokeWidth).toBe("");
    expect(path.getAttribute("stroke-width")).toBe(String(COLLECTIVE_STROKE));
  });

  it("adds nothing when there is no script target", () => {
    const wordmark = document.createElement("span");
    document.body.append(wordmark);
    const bare = buildIntroTimeline({ wordmark, script: null, seal: null });
    const withBeat = buildIntroTimeline({ wordmark, script: null, seal: null }, [collectiveBeat]);
    expect(withBeat.getChildren().length).toBe(bare.getChildren().length);
    expect(withBeat.duration()).toBeCloseTo(bare.duration(), 6);
  });

  it("is registered in introBeats under the collective label", () => {
    expect(introBeats).toContain(collectiveBeat);
    expect(collectiveBeat.label).toBe("collective");
  });
});
