/**
 * The browser APIs the DOM lib leaves out, declared once so the app reads
 * them without a cast. The page's other globals live with their owners:
 * `window.__gcc` in state/seam.ts, `VITE_SCENE_DEBUG` in vite-env.d.ts, the
 * AVIF verdict in device/avif.ts (which is loaded under the node tsconfig
 * too, where this file is not).
 */

/** the Network Information API's Save-Data hint, where a browser has it (Chromium); device/tier.ts reads it */
interface Navigator {
  readonly connection?: { readonly saveData?: boolean };
}
