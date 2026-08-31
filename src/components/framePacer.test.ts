import { describe, expect, it } from "vitest";

import { createFramePacer } from "./framePacer";

// the desktop pacing: 60fps under motion, a 20fps dust tick at rest,
// the dust easing to a stop half a minute after the last input
const cfg = { activeFps: 60, idleFps: 20, settleMs: 30_000, easeDownMs: 2500, easeUpMs: 600 };

describe("framePacer", () => {
  it("renders the very first frame", () => {
    const pacer = createFramePacer(cfg);
    expect(pacer.frame(0, true).render).toBe(true);
  });

  it("caps motion at activeFps: on a 120Hz display every other rAF draws", () => {
    const pacer = createFramePacer(cfg);
    pacer.frame(0, true);
    expect(pacer.frame(8.3, true).render).toBe(false);
    expect(pacer.frame(16.7, true).render).toBe(true);
    expect(pacer.frame(25, true).render).toBe(false);
    expect(pacer.frame(33.3, true).render).toBe(true);
  });

  it("drops to the dust tick at rest: ~20fps, not the active cap", () => {
    const pacer = createFramePacer(cfg);
    pacer.frame(0, true);
    // still from here on: only the dust is moving
    expect(pacer.frame(17, false).render).toBe(false);
    expect(pacer.frame(34, false).render).toBe(false);
    expect(pacer.frame(50, false).render).toBe(true);
    expect(pacer.frame(67, false).render).toBe(false);
    expect(pacer.frame(100, false).render).toBe(true);
  });

  it("half a minute after the last motion the dust eases out and rendering stops", () => {
    const pacer = createFramePacer(cfg);
    pacer.frame(0, true);
    // deep into the quiet: the ease begins at settleMs and runs easeDownMs
    expect(pacer.frame(cfg.settleMs, false).emberRate).toBe(1);
    const midway = pacer.frame(cfg.settleMs + cfg.easeDownMs / 2, false).emberRate;
    expect(midway).toBeGreaterThan(0);
    expect(midway).toBeLessThan(1);
    // eased out: one final frame lands the rest pose…
    const last = pacer.frame(cfg.settleMs + cfg.easeDownMs + 50, false);
    expect(last.emberRate).toBe(0);
    expect(last.render).toBe(true);
    // …and after it, nothing renders at all
    for (let i = 1; i <= 100; i++) {
      expect(pacer.frame(cfg.settleMs + cfg.easeDownMs + 50 + i * 50, false).render).toBe(false);
    }
  });

  it("any motion wakes it: an immediate frame, the dust easing back in rather than lurching", () => {
    const pacer = createFramePacer(cfg);
    pacer.frame(0, true);
    const asleep = cfg.settleMs + cfg.easeDownMs + 10_000;
    pacer.frame(asleep, false);
    // a scroll arrives
    const woke = pacer.frame(asleep + 50, true);
    expect(woke.render).toBe(true);
    expect(woke.emberRate).toBeGreaterThan(0);
    expect(woke.emberRate).toBeLessThan(0.5);
    // the drift is back to full speed within the ease-in, not instantly
    let rate = woke.emberRate;
    for (let ms = 100; ms <= cfg.easeUpMs + 200; ms += 50) {
      const next = pacer.frame(asleep + ms, true).emberRate;
      expect(next).toBeGreaterThanOrEqual(rate);
      rate = next;
    }
    expect(rate).toBe(1);
  });
});
