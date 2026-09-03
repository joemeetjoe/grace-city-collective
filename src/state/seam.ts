import { useAppStore } from "./appStore";

/**
 * The page's one named seam for the tooling under tools/: `window.__gcc`.
 * The shot scripts scroll through the smoother with it (`scrollTo`, set by
 * scroll/smoother.ts while one runs), the transfer trace reads the intro's
 * state off the store, and a debug build (`VITE_SCENE_DEBUG=1`) hangs the
 * scene's layers on it for cdp-rects.mjs. It exists in production because
 * the shots and the trace run against the built site; it is the only global
 * the app writes (tools/README.md, "The `window.__gcc` seam").
 */
export type GccSeam = {
  store: Pick<typeof useAppStore, "getState" | "subscribe">;
  /** instant scroll through the smoother, while one runs */
  scrollTo?: (top: number) => void;
  /** the scene's layers, scene and camera — a debug build only; typed by the engine */
  scene?: unknown;
};

declare global {
  interface Window {
    __gcc?: GccSeam;
  }
}

/** the seam: up from the first mount (app/initApp.ts calls it), whether or not anything hangs more on it */
export function seam(): GccSeam {
  return (window.__gcc ??= { store: useAppStore });
}
