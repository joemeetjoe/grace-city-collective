import { useProgress } from "@react-three/drei/core/Progress.js";
import { useEffect } from "react";
import { DefaultLoadingManager } from "three";

/**
 * The loading progress to the app store (#134 spike). Fiber's useLoader
 * builds its loaders on three's DefaultLoadingManager — a page-wide global
 * — so the count comes from there either way: drei's useProgress is a
 * zustand store over that manager's callbacks (and takes them over at
 * module evaluation); without drei the same callback is set here.
 */
export function useProgressToStore(setProgress: (loaded: number, total: number) => void): void {
  useEffect(() => {
    if (__R3F_DREI__) return useProgress.subscribe((s) => setProgress(s.loaded, s.total));
    const manager = DefaultLoadingManager;
    const previous = manager.onProgress;
    manager.onProgress = (_url, loaded, total) => setProgress(loaded, total);
    return () => {
      manager.onProgress = previous;
    };
  }, [setProgress]);
}
