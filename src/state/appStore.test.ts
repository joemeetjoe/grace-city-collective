import { afterEach, describe, expect, it } from "vitest";

import { TIERS } from "@/device/tier";
import { REST_STATE, useAppStore } from "./appStore";

const state = () => useAppStore.getState();

afterEach(() => useAppStore.setState(REST_STATE));

describe("appStore", () => {
  it("rests as a full-motion desktop past its intro, nothing loaded, on the scene", () => {
    expect(state()).toMatchObject(REST_STATE);
    expect(state().intro).toBe(false);
    expect(state().ready).toBe(false);
    expect(state().activeId).toBeNull();
    expect(state().sceneInView).toBe(true);
  });

  it("init takes a mount's decisions and puts every live fact back to rest", () => {
    state().setProgress(3, 4);
    state().markReady();
    state().setActiveId("faq");
    state().setSceneInView(false);
    state().init({ intro: true, reducedMotion: false, tier: TIERS.mobile, fallback: false, activeId: "hero" });
    expect(state()).toMatchObject({
      intro: true,
      reducedMotion: false,
      tier: TIERS.mobile,
      fallback: false,
      progress: 0,
      ready: false,
      activeId: "hero",
      sceneInView: true,
    });
    // the opening section is optional: none is current until the watch reports
    state().init({ intro: false, reducedMotion: true, tier: TIERS.desktop, fallback: true });
    expect(state()).toMatchObject({ intro: false, reducedMotion: true, fallback: true, activeId: null });
  });

  it("loading runs progress → ready, and the intro finishes once", () => {
    state().init({ intro: true, reducedMotion: false, tier: TIERS.desktop, fallback: false });
    state().setProgress(0, 0);
    expect(state().progress).toBe(0);
    state().setProgress(1, 4);
    expect(state().progress).toBe(0.25);
    state().setProgress(4, 4);
    expect(state().progress).toBe(1);
    expect(state().ready).toBe(false);
    state().markReady();
    expect(state().ready).toBe(true);
    expect(state().intro).toBe(true);
    expect(state().introPlayed).toBe(false);
    state().finishIntro();
    expect(state().intro).toBe(false);
    // the intro played: the reveals that follow the splash key on this
    expect(state().introPlayed).toBe(true);
    state().finishIntro();
    expect(state().intro).toBe(false);
  });

  it("tracks the active section and whether the scene is in view, and tells subscribers", () => {
    const seen: (string | null)[] = [];
    const stop = useAppStore.subscribe((s, prev) => {
      if (s.activeId !== prev.activeId) seen.push(s.activeId);
    });
    state().setActiveId("about");
    state().setActiveId("about");
    state().setActiveId("give");
    expect(seen).toEqual(["about", "give"]);
    stop();
    state().setActiveId(null);
    expect(seen).toEqual(["about", "give"]);
    state().setSceneInView(false);
    expect(state().sceneInView).toBe(false);
    state().setSceneInView(true);
    expect(state().sceneInView).toBe(true);
  });

  it("a failed scene records why and counts as ready, so the gate opens onto the poster (#131)", () => {
    state().init({ intro: true, reducedMotion: false, tier: TIERS.desktop, fallback: false });
    expect(state().sceneError).toBeNull();
    state().failScene("texture failed: /assets/map-fig5.avif");
    expect(state()).toMatchObject({ sceneError: "texture failed: /assets/map-fig5.avif", ready: true, intro: true, fallback: false });
    // the first failure is the one on record
    state().failScene("front canvas missing");
    expect(state().sceneError).toBe("texture failed: /assets/map-fig5.avif");
    // a new mount starts clean
    state().init({ intro: false, reducedMotion: false, tier: TIERS.desktop, fallback: false });
    expect(state()).toMatchObject({ sceneError: null, ready: false });
  });

  it("takes the device's live tier as a fact, leaving every other fact alone", () => {
    state().init({ intro: true, reducedMotion: false, tier: TIERS.desktop, fallback: false });
    state().setTier(TIERS.mobile);
    expect(state()).toMatchObject({ intro: true, tier: TIERS.mobile, fallback: false });
  });

  it("takes the live reduced-motion preference as a fact, and brings a splash still up down with it (#132)", () => {
    state().init({ intro: true, reducedMotion: false, tier: TIERS.desktop, fallback: false });
    state().setProgress(1, 2);
    state().setReducedMotion(true);
    // the splash comes down without the intro counting as played; the mount's other decisions stand
    expect(state()).toMatchObject({ reducedMotion: true, intro: false, introPlayed: false, fallback: false, progress: 0.5 });
    // flipping back brings nothing back: the intro is not replayed mid-session
    state().setReducedMotion(false);
    expect(state()).toMatchObject({ reducedMotion: false, intro: false, introPlayed: false });
    // past the intro, only the fact moves
    state().finishIntro();
    state().setReducedMotion(true);
    expect(state()).toMatchObject({ reducedMotion: true, intro: false, introPlayed: true });
  });
});
