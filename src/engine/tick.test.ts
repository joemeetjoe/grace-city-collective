import { describe, expect, it } from "vitest";

import { createTickState, tickFrame, type SceneOptions, type TickState } from "./tick";
import { SCENE_DEFAULTS } from "./tuning";

/** a pacer that draws every frame and records what the tick told it about motion */
function recordingPacer() {
  const moving: boolean[] = [];
  return { moving, frame: (_now: number, m: boolean) => (moving.push(m), { render: true, emberRate: 1 }) };
}

/** a scene at rest at the hero, ticked at 60 fps for `seconds` under `opts`; the pacer's record comes back */
function run(opts: Partial<SceneOptions>, seconds: number, state?: TickState) {
  const pacer = recordingPacer();
  const s = state ?? createTickState({ pacer, scrollDpr: { forSpeed: () => 1 } });
  s.pacer = pacer;
  const frames = Math.round(seconds * 60);
  for (let i = 0; i < frames; i++) {
    const t = i / 60;
    tickFrame(s, {
      now: t * 1000,
      t,
      scrollY: 0,
      progress: 0,
      sectionCount: 6,
      aspect: 16 / 9,
      baseZ: 10,
      reducedMotion: false,
      opts: { ...SCENE_DEFAULTS, ...opts },
    });
  }
  return { state: s, moving: pacer.moving };
}

describe("tickFrame idle drift (#132)", () => {
  it("with no drift the chases converge and the tick reports the scene still", () => {
    const { moving } = run({ idleDrift: false }, 4);
    expect(moving[0]).toBe(true);
    expect(moving.at(-1)).toBe(false);
  });

  it("the idle drift keeps the scene moving", () => {
    const { moving } = run({ idleDrift: true }, 4);
    expect(moving.every(Boolean)).toBe(true);
  });

  it("under reduced motion the drift stops, live: the scene settles as if there were none", () => {
    const { moving } = run({ idleDrift: true, reducedMotion: true }, 4);
    expect(moving.at(-1)).toBe(false);
    // and starts again when the preference flips back
    const drifting = run({ idleDrift: true }, 4);
    const again = run({ idleDrift: true, reducedMotion: true }, 4, drifting.state);
    expect(again.moving.at(-1)).toBe(false);
    const back = run({ idleDrift: true, reducedMotion: false }, 4, again.state);
    expect(back.moving.every(Boolean)).toBe(true);
  });
});
