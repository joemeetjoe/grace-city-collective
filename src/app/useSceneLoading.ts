import { useCallback, useState } from "react";

export type SceneLoading = {
  ready: boolean;
  progress: number;
  markReady: () => void;
  reportProgress: (loaded: number, total: number) => void;
};

/** the scene's texture loading, reported by the engine and read by the splash */
export function useSceneLoading(): SceneLoading {
  const [ready, setReady] = useState(false);
  // the textures' share so far, for the splash's loading trace
  const [progress, setProgress] = useState(0);
  const markReady = useCallback(() => setReady(true), []);
  const reportProgress = useCallback(
    (loaded: number, total: number) => setProgress(total ? loaded / total : 0),
    [],
  );
  return { ready, progress, markReady, reportProgress };
}
