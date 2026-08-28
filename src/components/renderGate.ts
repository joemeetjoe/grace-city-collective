export type RenderGate = {
  /** whether the loop is scheduled right now */
  readonly running: boolean;
  /** the canvas entered or left the viewport */
  setVisible(visible: boolean): void;
  /** stop for good; later visibility changes are ignored */
  dispose(): void;
};

/**
 * The decision behind pausing the WebGL loop: run only while the canvas is on
 * screen. Kept apart from requestAnimationFrame and IntersectionObserver so
 * the start/stop/no-double-start rules can be tested as plain calls.
 */
export function createRenderGate({ start, stop }: { start: () => void; stop: () => void }): RenderGate {
  let running = false;
  let disposed = false;
  return {
    get running() {
      return running;
    },
    setVisible(visible) {
      if (disposed || visible === running) return;
      running = visible;
      if (visible) start();
      else stop();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (running) {
        running = false;
        stop();
      }
    },
  };
}
