/**
 * Demand-driven pacing for the render loop (#68). The tick used to render
 * both canvases at full display refresh forever; the pacer decides, per rAF,
 * whether a frame is worth drawing:
 *
 *  - under motion (scroll, pointer, a chase still converging, an opts tween)
 *    frames render at `activeFps`;
 *  - at rest the embers are the only thing moving, so frames drop to the
 *    `idleFps` dust tick;
 *  - `settleMs` after the last motion the dust eases to a stop (`emberRate`
 *    ramps to 0 — the caller advances the ember clock by dt × rate, so the
 *    drift slows rather than freezes) and rendering stops entirely;
 *  - any motion wakes it: an immediate frame, the dust easing back up.
 *
 * Pure and clock-injected: `frame(now, moving)` is the whole interface.
 */

export type PacerConfig = {
  /** frame cap while anything but the dust is moving */
  activeFps: number;
  /** the dust tick at rest */
  idleFps: number;
  /** how long after the last motion the dust starts settling */
  settleMs: number;
  /** the dust's linear ease-out to a stop */
  easeDownMs: number;
  /** and its shorter ease back in on wake */
  easeUpMs: number;
};

/** pacing per tier: a phone draws fewer frames in both states */
export const PACING: Record<"desktop" | "mobile", PacerConfig> = {
  desktop: { activeFps: 60, idleFps: 20, settleMs: 30_000, easeDownMs: 2500, easeUpMs: 600 },
  mobile: { activeFps: 30, idleFps: 15, settleMs: 30_000, easeDownMs: 2500, easeUpMs: 600 },
};

export type FrameDecision = {
  render: boolean;
  /** 0…1: how fast the ember clock runs this frame */
  emberRate: number;
};

export function createFramePacer(cfg: PacerConfig) {
  const activeMs = 1000 / cfg.activeFps;
  const idleMs = 1000 / cfg.idleFps;
  // a display refresh sits a hair under the cap's interval; the slack keeps
  // a 60Hz screen rendering every frame under a 60fps cap
  const SLACK = 1.5;
  let lastRender = Number.NEGATIVE_INFINITY;
  let lastMoving = Number.NEGATIVE_INFINITY;
  let lastNow = Number.NEGATIVE_INFINITY;
  let rate = 1;

  return {
    frame(now: number, moving: boolean): FrameDecision {
      // rAF can gap (a paused loop, a throttled tab): the wake ramp integrates
      // a clamped dt so a gap never teleports the dust to full speed
      const dt = lastNow === Number.NEGATIVE_INFINITY ? 0 : Math.min(100, Math.max(0, now - lastNow));
      lastNow = now;
      if (moving) lastMoving = now;

      const prevRate = rate;
      // the settle is a pure ramp over quiet time, so it lands exactly at 0
      // however sparsely the idle tick samples it; the wake ramp rises from
      // wherever the settle left the rate
      const settle = Math.max(0, Math.min(1, 1 - (now - lastMoving - cfg.settleMs) / cfg.easeDownMs));
      rate = Math.min(settle, rate + dt / cfg.easeUpMs);

      const since = now - lastRender;
      const stopped = rate === 0 && prevRate === 0;
      const render = moving
        ? since >= activeMs - SLACK
        : !stopped && since >= (rate > 0 ? idleMs : activeMs) - SLACK;
      if (render) lastRender = now;
      return { render, emberRate: rate };
    },
  };
}
