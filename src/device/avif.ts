/**
 * Does this browser decode AVIF? The colour textures ship in both AVIF and
 * WebP (#101, dore-recut's pack step writes the pair); the manifest picks the
 * AVIF twin where it decodes and the WebP otherwise. Two static files per
 * texture, chosen by the client — no server logic.
 *
 * The verdict is settled once, by loading a one-pixel AVIF from a data URI,
 * and kept on the window under AVIF_VERDICT_KEY as a Promise<boolean> — or a
 * plain boolean, which a test harness (tools/perf/transfer.mjs --no-avif,
 * tools/shots/cdp-shot.mjs --no-avif) presets to force the WebP path. The
 * inline head script (avifProbeScript, emitted into index.html by Vitals
 * #113) and the bundle (supportsAvif) share one implementation: the head
 * starts the probe before the bundle arrives, and the bundle reads its
 * verdict rather than probing twice.
 *
 * Node-safe and relatively imported, like enginePreload.ts: vite.config.ts
 * loads this under the node tsconfig, so nothing here names the DOM types —
 * the window and Image are reached through globalThis with local shapes.
 */

/** the window property the verdict lives on */
export const AVIF_VERDICT_KEY = "__gccAvif";

/** a one-pixel AVIF (Pillow, quality 0, 4:0:0): 293 bytes, decodes to grey */
export const AVIF_PROBE_SRC =
  "data:image/avif;base64,AAAAHGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZgAAAOltZXRhAAAAAAAAACFoZGxyAAAAAAAAAABwaWN0AAAAAAAAAAAAAAAAAAAAAA5waXRtAAAAAAABAAAAHmlsb2MAAAAARAAAAQABAAAAAQAAAQ0AAAAYAAAAKGlpbmYAAAAAAAEAAAAaaW5mZQIAAAAAAQAAYXYwMUNvbG9yAAAAAGhpcHJwAAAASWlwY28AAAAUaXNwZQAAAAAAAAABAAAAAQAAAA5waXhpAAAAAAEIAAAADGF2MUOBABwAAAAAE2NvbHJuY2x4AAEADQAGgAAAABdpcG1hAAAAAAAAAAEAAQQBAoMEAAAAIG1kYXQSAAoHGAAGmAhoNTILH/UV3/4s/JA1r0A=";

/** settled, or on its way: a boolean once known, a promise of one until then */
export type AvifVerdict = boolean | Promise<boolean>;

type ImageLike = { onload: null | (() => void); onerror: null | (() => void); src: string; width: number };
type Host = { [AVIF_VERDICT_KEY]?: AvifVerdict; Image?: new () => ImageLike };

const host = (): Host => globalThis as unknown as Host;

/**
 * The inline script: probes once and stores the verdict on the window,
 * unless one is already there (a harness forcing the WebP path, or a
 * second run). No imports, no DOM beyond an Image.
 */
export function avifProbeScript(): string {
  const key = JSON.stringify(AVIF_VERDICT_KEY);
  return (
    "(function(){try{" +
    `if(window[${key}]!==undefined)return;` +
    `window[${key}]=new Promise(function(r){var i=new Image();` +
    "i.onload=function(){r(i.width>0)};i.onerror=function(){r(false)};" +
    `i.src=${JSON.stringify(AVIF_PROBE_SRC)}})` +
    `}catch(e){window[${key}]=false}})();`
  );
}

/** the same probe, from the bundle: an Image over the data URI, false where there is none */
function probe(): Promise<boolean> {
  const Image = host().Image;
  if (!Image) return Promise.resolve(false);
  return new Promise((resolve) => {
    try {
      const i = new Image();
      i.onload = () => resolve(i.width > 0);
      i.onerror = () => resolve(false);
      i.src = AVIF_PROBE_SRC;
    } catch {
      resolve(false);
    }
  });
}

/**
 * Whether the colour textures should be requested as AVIF: the head's verdict
 * where it has one (settled or pending), else this probe, kept for the next
 * caller so the window is only ever asked once.
 */
export function supportsAvif(): Promise<boolean> {
  const h = host();
  const known = h[AVIF_VERDICT_KEY];
  if (known !== undefined) return Promise.resolve(known);
  const verdict = probe();
  h[AVIF_VERDICT_KEY] = verdict;
  return verdict;
}
