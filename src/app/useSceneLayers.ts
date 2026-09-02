import { useEffect, useRef, useState, type RefObject } from "react";

import { useAppStore } from "@/state/appStore";
import { observeInView } from "@/ui/useInView";

export type SceneLayers = {
  parallaxRef: RefObject<HTMLDivElement | null>;
  frameRef: RefObject<HTMLDivElement | null>;
  frontRef: RefObject<HTMLDivElement | null>;
  frontCanvasRef: RefObject<HTMLCanvasElement | null>;
  sceneRef: RefObject<HTMLDivElement | null>;
  wrapperRef: RefObject<HTMLDivElement | null>;
  /** the smoother's content, the page's <main> */
  contentRef: RefObject<HTMLElement | null>;
  held: RefObject<HTMLDivElement | null>[];
};

/**
 * the scene's DOM handles. Every ref and the held list originate here, in
 * one hook, so useSmoothScroll keeps its run-once contract with the same ref
 * objects for the life of the mount. The one fact the scene's box yields —
 * whether it is on screen — goes to the store, never out of here as state.
 */
export function useSceneLayers(): SceneLayers {
  const parallaxRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);
  const frontCanvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLElement>(null);
  // the smoother's sticky stand-ins — every sticky layer of the scene, so the
  // front canvas and the frame ride with the back canvas; a stable list so
  // the hook runs once
  const [held] = useState(() => [parallaxRef, frontRef, frameRef]);

  // once the scene has scrolled away the nav sits over long-form text, so it
  // takes an ink backdrop to stay legible: the store's sceneInView, written
  // straight from the observer for the life of the mount; the next mount's
  // init puts it back to its rest value (in view), so unwatching writes nothing
  useEffect(() => observeInView(sceneRef.current, {}, useAppStore.getState().setSceneInView), []);

  return {
    parallaxRef,
    frameRef,
    frontRef,
    frontCanvasRef,
    sceneRef,
    wrapperRef,
    contentRef,
    held,
  };
}
