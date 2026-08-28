/**
 * Wraps a readiness listener so it fires at most once. A LoadingManager
 * reports `onLoad` every time its queue drains; the scene is ready the first
 * time.
 */
export function readyOnce(onReady: (() => void) | undefined): () => void {
  let fired = false;
  return () => {
    if (fired) return;
    fired = true;
    onReady?.();
  };
}
