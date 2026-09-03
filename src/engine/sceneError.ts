import { useAppStore } from "@/state/appStore";

/** the one console line a failed scene leaves (the tests count it) */
export const SCENE_ERROR_PREFIX = "[gcc] scene failed:";

/**
 * The scene's error path (#131), whichever way it arrives — the factory's
 * report (createParallaxScene.ts `onError`: a texture, the manifest, a refused
 * context, a missing front canvas) or a throw the boundary caught
 * (app/SceneBoundary.tsx: the engine chunk, a render). Logged once, then
 * recorded on the store, which counts the scene as ready: the splash opens
 * on time, onto the poster.
 */
export function reportSceneError(err: unknown): void {
  console.error(SCENE_ERROR_PREFIX, err);
  useAppStore.getState().failScene(err instanceof Error ? err.message : String(err));
}
