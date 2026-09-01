/**
 * The Three.js renderer's public surface — the repo's one barrel. Everything
 * else in engine/ is internal; consumers import only from "@/engine".
 */
export { default as PentecostParallax } from "./PentecostParallax";
export { default as StaticPoster } from "./StaticPoster";
export { vignetteCss } from "./vignette";
