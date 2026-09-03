/// <reference types="vite/client" />

/** the react-three-fiber spike (#134): VITE_R3F=1 mounts the engine under fiber; VITE_R3F_DREI=1 adds drei's hooks (vite.config.ts `define`) */
declare const __R3F__: boolean;
declare const __R3F_DREI__: boolean;
/** VITE_R3F_CANVAS=0: both roots through createRoot() on plain canvases, no <Canvas> (whose extend(THREE) keeps all of three) */
declare const __R3F_CANVAS__: boolean;

interface ImportMetaEnv {
  /** expose the scene layers on window for the solo shot script */
  readonly VITE_SCENE_DEBUG?: string;
}
