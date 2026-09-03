/**
 * The Three.js renderer's public surface — the repo's one barrel. Everything
 * else in engine/ is internal; consumers import only from "@/engine".
 *
 * The scene itself is behind a dynamic import (#98): three.js and the
 * parallax scene are their own chunk, requested the moment the page mounts
 * and module-preloaded from the HTML (device/enginePreload.ts), so the shell
 * becomes interactive before three arrives. The poster, the vignette and the
 * error report are plain DOM and stay in the shell.
 */
export { default as StaticPoster } from "./StaticPoster";
export { reportSceneError } from "./sceneError";
export { vignetteCss } from "./vignette";

/** the engine chunk: three.js and PentecostParallax, loaded on demand */
export const loadParallax = () => import("./PentecostParallax");

/** the same scene under react-three-fiber (#134 spike, VITE_R3F=1): a chunk of its own, never emitted by the default build */
export const loadParallaxFiber = () => import("./fiber/ParallaxFiber");
export type { ParallaxFiberProps } from "./fiber/ParallaxFiber";
