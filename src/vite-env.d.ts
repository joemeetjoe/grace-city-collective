/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** expose the scene layers on window for the solo shot script */
  readonly VITE_SCENE_DEBUG?: string;
}
