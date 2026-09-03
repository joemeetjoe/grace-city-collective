import { Observer } from "gsap/Observer";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { gsap } from "@/lib/gsap";
import { PAGE_EASE, SETTLE_DELAY_SECONDS } from "@/theme/motion";
import {
  idlePager,
  PAGE_TOLERANCE,
  settle,
  sync,
  touchMove,
  touchPress,
  turnEnded,
  wheel,
  type Page,
  type PagerEffect,
  type PagerState,
  type Step,
} from "./pager";
import type { SmoothScroll } from "./smoother";
import type { SnapLayout } from "./snap";
import { wheelPixels } from "./wheelGesture";

// the touch observer and the scene trigger below; registering again elsewhere is a no-op
gsap.registerPlugin(Observer, ScrollTrigger);

/** a wheel event measured in lines (Firefox), as pixels */
const LINE_PX = 20;

export type PagerTargets = {
  /** the six-section scene; the paged region */
  scene: HTMLElement;
  /** the smoother, while one runs: the turns write to it. Null writes to the window */
  smooth: SmoothScroll | null;
  /** the scene sections' document tops, ascending, as of the last measure (sectionWatch.ts) */
  tops(): number[];
  /** told after every re-measure of the tops */
  onMeasure(listener: () => void): () => void;
};

/** the scroll position the page turns write to: the smoother's when there is one, else the window's */
function scrollSeat(smooth: SmoothScroll | null) {
  return smooth
    ? { get: () => smooth.driver.scrollTop(), set: (y: number) => smooth.driver.scrollTo(y, false) }
    : { get: () => window.scrollY, set: (y: number) => window.scrollTo(0, y) };
}

/**
 * The pager (pager.ts) on the page: holds its state, listens to the wheel,
 * the finger (a gsap Observer) and the scroll, and carries the effects out.
 * The turns and the settles are one tween over a proxy, written to the
 * scroll each frame — not ScrollTrigger's snap: that one kills its tween on
 * any wheel event, prevented or not, and a swipe's tail keeps those coming.
 * Returns the function that takes it all down.
 */
export function attachPager({ scene, smooth, tops, onMeasure }: PagerTargets): () => void {
  const seat = scrollSeat(smooth);
  let state: PagerState = idlePager;
  let layout: SnapLayout = { tops: [], end: 0 };
  let turn: gsap.core.Tween | null = null;
  // the wheel event being answered, for the effect that prevents it
  let event: WheelEvent | null = null;
  const page = (): Page => ({ scrollY: seat.get(), layout });

  const turnTo = (top: number, seconds: number) => {
    turn?.kill();
    smooth?.interrupt(); // an in-flight nav jump gives way
    const proxy = { y: seat.get() };
    turn = gsap.to(proxy, {
      y: top,
      duration: seconds,
      ease: PAGE_EASE,
      onUpdate: () => seat.set(proxy.y),
      onComplete: () => {
        smooth?.settle();
        run(turnEnded(state, page()));
      },
    });
  };

  const perform = (effect: PagerEffect) => {
    switch (effect.kind) {
      case "prevent":
        event?.preventDefault();
        break;
      case "hold":
        observer.enable();
        break;
      case "release":
        observer.disable();
        break;
      case "turn":
        turnTo(effect.top, effect.seconds);
        break;
      case "scrollBy":
        window.scrollBy(0, effect.px);
        break;
      case "retry":
        settleCall.restart(true);
        break;
    }
  };
  const run = ({ state: next, effects }: Step) => {
    state = next;
    for (const effect of effects) perform(effect);
  };

  // a finger drag on a touch device: one turn per press, the drag prevented.
  // A finger dragged up asks for what is below: onward
  const observer = Observer.create({
    type: "touch",
    tolerance: PAGE_TOLERANCE,
    preventDefault: true,
    onPress: () => run(touchPress(state)),
    onUp: (self) => run(touchMove(state, 1, self.deltaY, page())),
    onDown: (self) => run(touchMove(state, -1, self.deltaY, page())),
  });
  observer.disable();

  // the settle, SETTLE_DELAY_SECONDS after the last scroll update
  const settleCall = gsap.delayedCall(SETTLE_DELAY_SECONDS, () => run(settle(state, sceneTrigger.getVelocity(), page()))).pause();
  const sceneTrigger = ScrollTrigger.create({
    trigger: scene,
    start: "top top",
    end: "bottom bottom",
    onUpdate: () => settleCall.restart(true),
  });

  // the layout: the sections' tops from the watch, the scene's end from its trigger
  const syncHold = () => run(sync(state, window.scrollY, layout));
  const measure = () => {
    layout = { tops: tops(), end: sceneTrigger.end };
    syncHold();
  };
  const onWheel = (e: WheelEvent) => {
    event = e;
    run(wheel(state, wheelPixels(e, LINE_PX, window.innerHeight), e.timeStamp, page()));
    event = null;
  };
  const stopMeasure = onMeasure(measure);
  measure();
  window.addEventListener("scroll", syncHold, { passive: true });
  window.addEventListener("wheel", onWheel, { passive: false });

  return () => {
    window.removeEventListener("scroll", syncHold);
    window.removeEventListener("wheel", onWheel);
    stopMeasure();
    turn?.kill();
    settleCall.kill();
    sceneTrigger.kill();
    observer.kill();
  };
}
