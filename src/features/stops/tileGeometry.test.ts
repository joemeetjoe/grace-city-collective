import { describe, expect, it } from "vitest";

import { TILE_STAGGER_MS } from "@/theme/motion";
import {
  AT_REST,
  ENTER_OUT,
  ENTER_SCALE,
  TILE_TRANSITION,
  enterLift,
  enterPose,
  fadeStyle,
  pose,
  stagger,
  staggerMs,
  tileStyle,
  tileTransition,
} from "./tileGeometry";

describe("the tile engine's geometry", () => {
  it("staggers a piece by its place in the order, at the tiles' pace unless told another", () => {
    expect(staggerMs(0)).toBe(0);
    expect(staggerMs(3)).toBe(3 * TILE_STAGGER_MS);
    expect(staggerMs(2, 160)).toBe(320);
    expect(stagger(4)).toBe(`${4 * TILE_STAGGER_MS}ms`);
    expect(stagger(0, 160)).toBe("0ms");
  });

  it("poses a tile about its own centre: a translate in px, then a scale", () => {
    expect(pose(0, 0)).toBe("translate(0px, 0px) scale(1)");
    expect(pose(12, -7.5, 1.6)).toBe("translate(12px, -7.5px) scale(1.6)");
    expect(AT_REST).toBe(pose(0, 0, 1));
  });

  it("a waiting tile sits out along its direction by ENTER_OUT of its height, at ENTER_SCALE", () => {
    expect(ENTER_OUT).toBe(0.6);
    expect(ENTER_SCALE).toBe(0.55);
    expect(enterPose(0, -1, 10)).toBe("translate(0px, -6px) scale(0.55)");
    expect(enterPose(1, 0, 10)).toBe("translate(6px, 0px) scale(0.55)");
    expect(enterPose(-1, -1, 20)).toBe("translate(-12px, -12px) scale(0.55)");
    expect(enterLift(10)).toBe(-6);
  });

  it("builds the transition utility over the properties named, in that order, colour in .5s and place in .9s on the site's ease", () => {
    expect(tileTransition(["opacity", "transform"])).toBe(
      "motion-safe:[transition:opacity_.9s_var(--ease-site),transform_.9s_var(--ease-site)]",
    );
    expect(TILE_TRANSITION).toBe(
      "motion-safe:[transition:fill_.5s_ease,fill-opacity_.5s_ease,stroke_.5s_ease,stroke-opacity_.5s_ease,opacity_.9s_var(--ease-site),transform_.9s_var(--ease-site)]",
    );
    expect(tileTransition(["fill", "fill-opacity", "stroke-opacity", "opacity", "transform"])).toBe(
      "motion-safe:[transition:fill_.5s_ease,fill-opacity_.5s_ease,stroke-opacity_.5s_ease,opacity_.9s_var(--ease-site),transform_.9s_var(--ease-site)]",
    );
  });

  it("a pose group's style transforms about its own box, waits its turn, and is faded until shown", () => {
    expect(tileStyle("scale(1)", "50ms", true)).toEqual({
      transform: "scale(1)",
      transformOrigin: "center",
      transformBox: "fill-box",
      transitionDelay: "50ms",
      opacity: 1,
    });
    expect(tileStyle(AT_REST, "0ms", false).opacity).toBe(0);
    expect(fadeStyle(true, "100ms")).toEqual({ opacity: 1, transitionDelay: "100ms" });
    expect(fadeStyle(false, "0ms")).toEqual({ opacity: 0, transitionDelay: "0ms" });
  });
});
