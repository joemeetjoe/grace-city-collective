import { create } from "zustand";

import type { SectionId } from "@/content/site";
import { TIERS, type Tier } from "@/device/tier";

/**
 * The facts that are global to the page, in one store. Components read it
 * through selectors (`useAppStore((s) => s.intro)`); the engine, the scroll
 * smoother and the intro modules read and subscribe to it directly through
 * `useAppStore.getState()` / `.subscribe`. Refs and DOM handles never go in
 * here: they stay with the hooks that own them (app/useSceneLayers.ts).
 */
export type AppState = {
  /** the splash is still up */
  intro: boolean;
  /**
   * the intro played this mount and its handoff has landed: the nav unfurls
   * and the hero headline settles in the commit that drops the splash
   * (features/intro/useIntroReveals.ts). Never set in a session the splash
   * does not mount in, which renders everything at rest
   */
  introPlayed: boolean;
  /** the visitor prefers reduced motion: no splash, native scroll, ornaments at rest */
  reducedMotion: boolean;
  /**
   * the asset tier the device reads as (device/tier.ts): the mount's at
   * init, then live (state/syncTier.ts). A fact only — the scene keeps the
   * tier it mounted with, its textures cut for it (app/HomePage.tsx)
   */
  tier: Tier;
  /** the still poster stands in for the scene: no WebGL, reduced motion, or Save-Data */
  fallback: boolean;
  /** the textures' share so far, 0–1, for the splash's loading trace */
  progress: number;
  /** every texture (or the poster) has arrived */
  ready: boolean;
  /**
   * why the scene gave up (#131): a texture or its manifest failed, WebGL was
   * refused at mount, the front canvas was missing. The poster stands in
   * from here; `fallback` stays the mount's own decision
   */
  sceneError: string | null;
  /** the section under the viewport's midpoint, read by the nav links and the dot rail alike */
  activeId: SectionId | null;
  /** the scene is on screen; once it has scrolled away the nav takes an ink backdrop */
  sceneInView: boolean;
};

/** what a mount decides once (app/initApp.ts): the intro policy and the device's verdicts */
export type AppProfile = Pick<AppState, "intro" | "reducedMotion" | "tier" | "fallback"> & {
  /** the section the page opens on, current until the section watch reports (scroll/sectionWatch.ts) */
  activeId?: SectionId | null;
};

type AppActions = {
  /** a mount's decisions in, and every live fact back to its rest value */
  init: (profile: AppProfile) => void;
  /** the handoff has landed (features/intro/introMachine.ts): the splash unmounts and the reveals follow */
  finishIntro: () => void;
  /** a texture arrived: how many so far, of how many requested */
  setProgress: (loaded: number, total: number) => void;
  markReady: () => void;
  /** the scene failed: record the first reason and count as ready, so the splash opens onto the poster */
  failScene: (message: string) => void;
  setActiveId: (id: SectionId | null) => void;
  setSceneInView: (inView: boolean) => void;
  /** the device reads as another tier now (a resize across the line, another display) */
  setTier: (tier: Tier) => void;
};

export type AppStore = AppState & AppActions;

/** before any mount has decided: a full-motion desktop past its intro, nothing loaded */
export const REST_STATE: AppState = {
  intro: false,
  introPlayed: false,
  reducedMotion: false,
  tier: TIERS.desktop,
  fallback: false,
  progress: 0,
  ready: false,
  sceneError: null,
  activeId: null,
  sceneInView: true,
};

export const useAppStore = create<AppStore>()((set) => ({
  ...REST_STATE,
  init: ({ activeId = null, ...profile }) => set({ ...REST_STATE, ...profile, activeId }),
  finishIntro: () => set({ intro: false, introPlayed: true }),
  setProgress: (loaded, total) => set({ progress: total ? loaded / total : 0 }),
  markReady: () => set({ ready: true }),
  failScene: (message) => set((s) => ({ sceneError: s.sceneError ?? message, ready: true })),
  setActiveId: (activeId) => set({ activeId }),
  setSceneInView: (sceneInView) => set({ sceneInView }),
  setTier: (tier) => set({ tier }),
}));
