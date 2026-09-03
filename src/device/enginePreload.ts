/**
 * The engine chunk (three.js and the parallax scene) is dynamically imported
 * at mount, so the browser would only discover it once the shell has parsed
 * and run. This inline head script, emitted into index.html at build with
 * the chunk's hashed URL, starts the download alongside the shell instead —
 * but only when the scene will render: a device that takes the still poster
 * (no WebGL, reduced motion, Save-Data: fallback.ts) never requests it.
 *
 * DOM-free and relatively imported: vite.config.ts builds this under the
 * node tsconfig, like the static splash.
 */
import { REDUCED_MOTION_QUERY } from "./reducedMotion";

/** marks the injected link */
export const ENGINE_PRELOAD_ATTR = "data-engine-preload";

/** the inline script: mirrors shouldUseStaticFallback, then appends a modulepreload for `href` */
export function enginePreloadScript(href: string): string {
  return (
    "(function(){try{" +
    `if(matchMedia(${JSON.stringify(REDUCED_MOTION_QUERY)}).matches)return;` +
    "if(navigator.connection&&navigator.connection.saveData===true)return;" +
    'var c=document.createElement("canvas");' +
    'if(!(c.getContext("webgl2")||c.getContext("webgl")))return;' +
    'var l=document.createElement("link");l.rel="modulepreload";' +
    `l.href=${JSON.stringify(href)};l.setAttribute("crossorigin","");` +
    `l.setAttribute(${JSON.stringify(ENGINE_PRELOAD_ATTR)},"");document.head.appendChild(l)` +
    "}catch(e){}})();"
  );
}

/** the module whose dynamic import (engine/index.ts) produces the engine chunk */
export const ENGINE_ENTRY = "/src/engine/PentecostParallax.tsx";

/** what the build hands transformIndexHtml: the emitted chunks, keyed by file name */
export type BundleLike = Record<string, { type: string; fileName: string; facadeModuleId?: string | null }>;

/** the engine chunk's url under the site's base; an error if the build emitted none */
export function engineChunkHref(bundle: BundleLike, base: string): string {
  const chunk = Object.values(bundle).find(
    (c) => c.type === "chunk" && c.facadeModuleId?.endsWith(ENGINE_ENTRY),
  );
  if (!chunk) throw new Error(`no engine chunk in the build (dynamic import of ${ENGINE_ENTRY})`);
  return `${base.replace(/\/+$/, "")}/${chunk.fileName}`;
}
