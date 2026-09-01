import { useRef, useState, type RefObject } from "react";

import { useBelowLg } from "@/layout/breakpoint";
import { useViewportHeight } from "@/layout/viewportHeight";
import { useInView } from "@/ui/useInView";

export type SceneLayers = {
  parallaxRef: RefObject<HTMLDivElement | null>;
  frameRef: RefObject<HTMLDivElement | null>;
  frontRef: RefObject<HTMLDivElement | null>;
  frontCanvasRef: RefObject<HTMLCanvasElement | null>;
  sceneRef: RefObject<HTMLDivElement | null>;
  wrapperRef: RefObject<HTMLDivElement | null>;
  contentRef: RefObject<HTMLDivElement | null>;
  held: RefObject<HTMLDivElement | null>[];
  sceneInView: boolean;
  frameHeight: number | null;
};

/**
 * the scene's DOM handles and viewport measures. Every ref and the held list
 * originate here, in one hook, so useSmoothScroll keeps its run-once contract
 * with the same ref objects for the life of the mount.
 */
export function useSceneLayers(): SceneLayers {
  const parallaxRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);
  const frontCanvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  // the smoother's sticky stand-ins — every sticky layer of the scene, so the
  // front canvas and the frame ride with the back canvas; a stable list so
  // the hook runs once
  const [held] = useState(() => [parallaxRef, frontRef, frameRef]);

  // once the scene has scrolled away the nav sits over long-form text, so it
  // takes an ink backdrop to stay legible
  const sceneInView = useInView(sceneRef, { initial: true });

  // below lg the frame's dvh steps as the URL bar moves; a measured px
  // height lets the layer's transition glide between the steps instead
  const frameHeight = useViewportHeight(useBelowLg());

  return {
    parallaxRef,
    frameRef,
    frontRef,
    frontCanvasRef,
    sceneRef,
    wrapperRef,
    contentRef,
    held,
    sceneInView,
    frameHeight,
  };
}
