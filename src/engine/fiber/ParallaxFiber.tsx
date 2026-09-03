import { Canvas, createRoot, useFrame, type RootState } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";

import { TIERS } from "@/device/tier";
import { useAppStore } from "@/state/appStore";
import { layerMask, type CanvasSide } from "@/theme/layerSplit";
import { tokens } from "@/theme/tokens";
import { PACING, createFramePacer } from "../framePacer";
import type { PentecostParallaxProps } from "../PentecostParallax";
import { SCROLL_DPR, createScrollDpr, movingDprFor } from "../scrollDpr";
import { createTickState } from "../tick";
import { GL_FLAGS, SCENE_DEFAULTS } from "../tuning";
import { useProgressToStore } from "./progress";
import SceneGraph from "./SceneGraph";
import { createSceneLoop, type SceneLoop } from "./sceneLoop";
import { createShared, registerRoot, setSceneOptions, type Shared } from "./shared";

/**
 * The scene under react-three-fiber (#134 spike), with PentecostParallax's
 * props and DOM contract: the back root is a <Canvas frameloop="never">
 * here (it makes its own canvas, as the vanilla component did), the front
 * root is fiber's createRoot() on the page's front canvas — the one
 * HomePage stacks over the copy — so the page changes nothing. The two
 * roots share one scene graph, one camera and the loaded textures
 * (sceneTextures.ts), and one external loop (sceneLoop.ts) decides each
 * frame and calls advance() on both. Loading progress and the ready signal
 * go to the app store as before.
 *
 * VITE_R3F_CANVAS=0 builds the back root the same way, through createRoot()
 * on a plain canvas of this component's own: <Canvas> calls extend(THREE)
 * with the whole namespace, which keeps every class of three in the chunk;
 * the imperative root needs no catalogue, since the graph is a <primitive>.
 *
 * Only the VITE_R3F=1 build mounts this; the default build folds the branch
 * away in HomePage and emits no chunk for the module.
 */
export type ParallaxFiberProps = PentecostParallaxProps;

const canvasStyle = { position: "absolute", inset: 0 } as const;

export default function ParallaxFiber({
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
}: ParallaxFiberProps) {
  const once = useRef({ frontCanvas, sections, scrollTop }); // read once, at mount
  const [{ shared, dpr }] = useState(() => {
    const { reducedMotion } = useAppStore.getState();
    const dpr = Math.min(window.devicePixelRatio || 1, tier.dprCap);
    const state = createTickState({
      pacer: createFramePacer(PACING[tier.name]),
      scrollDpr: createScrollDpr({ sharp: dpr, moving: movingDprFor(dpr), ...SCROLL_DPR }),
    });
    const opts = { layerSpread, figureRelief, beamGlow, flameDrift, idleDrift, orbitYaw, orbitPitch, reliefMax };
    return { shared: createShared({ tier, reducedMotion, state, opts }), dpr };
  });
  const loop = useRef<SceneLoop | null>(null);

  // live props: a change marks a frame, never rebuilds
  useEffect(() => {
    setSceneOptions(shared, { layerSpread, figureRelief, beamGlow, flameDrift, idleDrift, orbitYaw, orbitPitch, reliefMax });
    loop.current?.wake();
  }, [shared, layerSpread, figureRelief, beamGlow, flameDrift, idleDrift, orbitYaw, orbitPitch, reliefMax]);

  // the loop for the mount: the gate arms once both roots are up and the graph is built
  useEffect(() => {
    const { sections, scrollTop } = once.current;
    const { markReady } = useAppStore.getState();
    const l = createSceneLoop(shared, { sections, scrollTop, onReady: markReady, dpr });
    loop.current = l;
    l.arm();
    return () => {
      l.dispose();
      loop.current = null;
    };
  }, [shared, dpr]);
  useProgressToStore(useAppStore.getState().setProgress);

  const onCreated = useCallback(
    (side: CanvasSide) => (state: RootState) => {
      // the back canvas clears to ink, the front to nothing: only its layers land over the page
      if (side === "back") state.gl.setClearColor(tokens.ink, 1);
      else state.gl.setClearColor(0x000000, 0);
      registerRoot(shared, side, state);
      loop.current?.arm();
    },
    [shared],
  );
  const onBuilt = useCallback(() => {
    loop.current?.arm();
    loop.current?.warm();
  }, []);

  // the front root, on the page's own front canvas: the imperative API, since
  // <Canvas> always makes a canvas of its own. Sized like the back root
  // (syncResize); one context per canvas, disposed with the mount
  useEffect(() => {
    const canvas = once.current.frontCanvas?.current;
    if (!canvas) return;
    const root = createRoot(canvas);
    void root.configure({ frameloop: "never", flat: true, dpr, camera: shared.camera, gl: { ...GL_FLAGS, alpha: true }, onCreated: onCreated("front") });
    root.render(<FrontPass shared={shared} />);
    return () => root.unmount();
  }, [shared, dpr, onCreated]);

  // the back root without <Canvas>: createRoot() on this component's canvas,
  // sized from its parent once (fiber measures nothing here; syncResize
  // keeps the front root at the back root's size, the back root follows
  // the window in sceneLoop.ts)
  const backCanvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = backCanvas.current;
    if (__R3F_CANVAS__ || !canvas) return;
    const root = createRoot(canvas);
    void root.configure({ frameloop: "never", flat: true, dpr, scene: shared.scene, camera: shared.camera, gl: { ...GL_FLAGS }, onCreated: onCreated("back") });
    root.render(
      <Suspense fallback={null}>
        <SceneGraph shared={shared} rays={rays} embers={embers} onBuilt={onBuilt} />
      </Suspense>,
    );
    return () => root.unmount();
    // rays and embers are read once, at mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shared, dpr, onCreated, onBuilt]);

  if (!__R3F_CANVAS__) {
    return <canvas ref={backCanvas} aria-hidden className={className ?? "absolute inset-0 block h-full w-full"} />;
  }
  return (
    <Canvas
      frameloop="never"
      flat
      dpr={dpr}
      scene={shared.scene}
      camera={shared.camera}
      gl={{ ...GL_FLAGS }}
      onCreated={onCreated("back")}
      style={canvasStyle}
      className={className}
      aria-hidden
    >
      <Suspense fallback={null}>
        <SceneGraph shared={shared} rays={rays} embers={embers} onBuilt={onBuilt} />
      </Suspense>
    </Canvas>
  );
}

/** the front pass: the same scene and camera through this root's renderer, masked to the front layer */
function FrontPass({ shared }: { shared: Shared }) {
  useFrame(({ gl }) => {
    if (!shared.plan) return;
    shared.camera.layers.set(layerMask("front"));
    gl.render(shared.scene, shared.camera);
  }, 1);
  return null;
}
