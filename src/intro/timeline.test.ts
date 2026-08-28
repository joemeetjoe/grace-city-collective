import { describe, expect, it } from "vitest";

import { INTRO_LABELS, buildIntroTimeline, type IntroBeat, type IntroTargets } from "./timeline";

function targets(): IntroTargets {
  const wordmark = document.createElement("span");
  wordmark.textContent = "Grace City";
  document.body.append(wordmark);
  return { wordmark, script: null, seal: null };
}

describe("buildIntroTimeline", () => {
  it("lays out the three beats as labels in order: wordmark, collective, seal", () => {
    const tl = buildIntroTimeline(targets());
    tl.pause();
    const { wordmark, collective, seal } = tl.labels;
    expect(wordmark).toBe(0);
    expect(collective).toBeCloseTo(INTRO_LABELS.collective, 6);
    expect(seal).toBeCloseTo(INTRO_LABELS.seal, 6);
    expect(wordmark).toBeLessThan(collective);
    expect(collective).toBeLessThan(seal);
  });

  it("reveals the wordmark over ~0.7s with only the wordmark beat installed", () => {
    const tl = buildIntroTimeline(targets());
    tl.pause();
    expect(tl.duration()).toBeCloseTo(0.7, 1);
  });

  it("lets later beats plug into their label without reworking the sequence", () => {
    const seen: string[] = [];
    const beat: IntroBeat = {
      label: "collective",
      add(tl, _t, at) {
        seen.push(at);
        tl.to({}, { duration: 1.2 }, at);
      },
    };
    const tl = buildIntroTimeline(targets(), [beat]);
    tl.pause();
    expect(seen).toEqual(["collective"]);
    expect(tl.duration()).toBeCloseTo(INTRO_LABELS.collective + 1.2, 6);
  });
});
