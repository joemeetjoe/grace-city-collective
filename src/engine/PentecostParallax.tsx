import { useEffect, useRef, type RefObject } from "react";

import { TIERS, type Tier } from "@/device/tier";
import { useAppStore } from "@/state/appStore";
import { seam } from "@/state/seam";
import { createParallaxScene, type SceneHandle } from "./createParallaxScene";
import { reportSceneError } from "./sceneError";
import type { SceneOptions } from "./tick";
import { SCENE_DEFAULTS } from "./tuning";

export type PentecostParallaxProps = Partial<Omit<SceneOptions, "reliefMax" | "reducedMotion">> & {
  /** figureRelief ramps to this with the pointer at either edge */
  reliefGain?: number;
  /** how many ray planes fan out from the dove (read once, when the scene builds) */
  rays?: number;
  /** how many embers drift in the foreground; 0 disables the layer (read once) */
  embers?: number;
  /** a second canvas, stacked above the page's type, for the nearest layers (layerSplit.ts) */
  frontCanvas?: RefObject<HTMLCanvasElement | null>;
  /** asset tier (device/tier.ts); read once at mount */
  tier?: Tier;
  /** the scene sections the camera paces against (HomePage, over scroll/sections.ts), and the page's scroll (useSmoothScroll.ts; the document's own by default): read once the scene builds */
  sections: () => readonly HTMLElement[];
  scrollTop?: () => number;
  className?: string;
};

/**
 * The scene as a component: mounts createParallaxScene() against its own canvas
 * (and the front one), forwards the live options, and disposes. The loading
 * progress, the ready signal and a failure go to the app store (a failure
 * logged once on the way, sceneError.ts); a debug build hangs the built
 * scene on the page's seam for tools/shots/cdp-rects.mjs. Under StrictMode
 * the first mount is disposed whole before the second builds: one live renderer per canvas.
 */
export default function PentecostParallax({
  layerSpread = SCENE_DEFAULTS.layerSpread,
  figureRelief = SCENE_DEFAULTS.figureRelief,
  beamGlow = SCENE_DEFAULTS.beamGlow,
  flameDrift = SCENE_DEFAULTS.flameDrift,
  idleDrift = SCENE_DEFAULTS.idleDrift,
  orbitYaw = SCENE_DEFAULTS.orbitYaw,
  orbitPitch = SCENE_DEFAULTS.orbitPitch,
  reliefGain: reliefMax = SCENE_DEFAULTS.reliefMax,
  rays,
  embers,
  frontCanvas,
  tier = TIERS.desktop,
  sections,
  scrollTop,
  className,
}: PentecostParallaxProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handle = useRef<SceneHandle | null>(null);
  const once = useRef({ tier, rays, embers, frontCanvas, sections, scrollTop }); // read once, at mount
  // live props, so tweaking them never rebuilds the scene: this effect runs first, so the scene builds with the first values
  const options = useRef<Omit<SceneOptions, "reducedMotion">>({ ...SCENE_DEFAULTS }); // reducedMotion is the store's, not a prop's (#132)
  useEffect(() => {
    options.current = { layerSpread, figureRelief, beamGlow, flameDrift, idleDrift, orbitYaw, orbitPitch, reliefMax };
    handle.current?.setOptions(options.current);
  }, [layerSpread, figureRelief, beamGlow, flameDrift, idleDrift, orbitYaw, orbitPitch, reliefMax]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { tier, rays, embers, frontCanvas, sections, scrollTop } = once.current;
    const { reducedMotion, setProgress, markReady } = useAppStore.getState();
    const debug = import.meta.env.VITE_SCENE_DEBUG ? (scene: unknown) => void (seam().scene = scene) : undefined;
    handle.current = createParallaxScene(
      { back: canvas, front: frontCanvas?.current },
      { tier, rays, embers, reducedMotion, sections, scrollTop, onProgress: setProgress, onReady: markReady, onError: reportSceneError, debug },
      { ...options.current, reducedMotion },
    );
    // the preference stays live (#132, state/syncReducedMotion.ts): a flip reaches the scene as an option, so the idle drift stops and starts with it
    const unsubscribe = useAppStore.subscribe((s, prev) => {
      if (s.reducedMotion !== prev.reducedMotion) handle.current?.setOptions({ reducedMotion: s.reducedMotion });
    });
    return () => {
      unsubscribe();
      handle.current?.dispose();
      handle.current = null;
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className={className ?? "absolute inset-0 block h-full w-full"} />;
}
