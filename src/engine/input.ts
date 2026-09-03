import { armGyroOnFirstTouch } from "@/device/gyro";
import { GYRO } from "./tuning";

/**
 * The scene's inputs as subscribers (#120): the pointer and the gyro (which
 * write the same −1..1 target), the wake sources that re-arm a parked loop,
 * the resize, the tab's visibility, the canvas's presence on screen and the
 * sections' boxes. The factory takes this shape and never a window or a
 * document; `browserInput` is the one that listens to the page, a test
 * passes its own.
 */
export type SceneInput = {
  /** the pointer in −1..1 across the viewport */
  onPointer(cb: (x: number, y: number) => void): () => void;
  /** the phone's tilt, mapped to the same −1..1 */
  onTilt(cb: (x: number, y: number) => void): () => void;
  /** scroll intent in any form: wheel, scroll, touch, key */
  onWake(cb: () => void): () => void;
  onResize(cb: () => void): () => void;
  /** the tab shown or hidden: called with whether it is visible, once at subscribe and on every change */
  onVisibility(cb: (visible: boolean) => void): () => void;
  /** the canvas entering or leaving the viewport; called once with the initial state where observable */
  onScreen(canvas: HTMLCanvasElement, cb: (onScreen: boolean) => void): () => void;
  /** a section's box changing (a reveal opening, fonts arriving) */
  onBoxChange(els: readonly HTMLElement[], cb: () => void): () => void;
  /** iOS only delivers tilt after a permission prompt raised from a touch */
  armGyro(): () => void;
};

const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));

/** the gyro's angles as a pointer: gamma across, beta (less the resting pitch) down */
function tiltToPointer(gamma: number, beta: number | null, g = GYRO): [number, number] {
  return [clamp1(gamma / g.gammaSpan), clamp1(((beta ?? g.betaRest) - g.betaRest) / g.betaSpan)];
}

/** the page's inputs, from the window and the document */
export function browserInput(win: Window = window, doc: Document = document): SceneInput {
  const listen = <K extends keyof WindowEventMap>(
    type: K,
    cb: (e: WindowEventMap[K]) => void,
    opts?: AddEventListenerOptions,
  ) => {
    win.addEventListener(type, cb, opts);
    return () => win.removeEventListener(type, cb);
  };
  return {
    onPointer: (cb) =>
      listen("pointermove", (e) => cb((e.clientX / win.innerWidth) * 2 - 1, (e.clientY / win.innerHeight) * 2 - 1)),
    onTilt: (cb) =>
      listen("deviceorientation", (e) => {
        if (e.gamma == null) return;
        cb(...tiltToPointer(e.gamma, e.beta));
      }),
    onWake(cb) {
      const offs = [
        listen("wheel", cb, { passive: true }),
        listen("scroll", cb, { passive: true }),
        listen("touchstart", cb, { passive: true }),
        listen("keydown", cb),
      ];
      return () => offs.forEach((off) => off());
    },
    onResize: (cb) => listen("resize", cb),
    onVisibility(cb) {
      const on = () => cb(!doc.hidden);
      doc.addEventListener("visibilitychange", on);
      return () => doc.removeEventListener("visibilitychange", on);
    },
    onScreen(canvas, cb) {
      if (typeof IntersectionObserver === "undefined") {
        cb(true);
        return () => {};
      }
      const observer = new IntersectionObserver(([entry]) => cb(entry.isIntersecting));
      observer.observe(canvas);
      return () => observer.disconnect();
    },
    onBoxChange(els, cb) {
      const observer = new ResizeObserver(cb);
      for (const el of els) observer.observe(el);
      return () => observer.disconnect();
    },
    armGyro: () => armGyroOnFirstTouch(win),
  };
}
