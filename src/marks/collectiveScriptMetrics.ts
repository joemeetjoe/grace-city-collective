/**
 * Metrics of the "Collective" script artwork (collectiveScriptPaths.ts,
 * drawn by CollectiveScript.tsx), in a plain module so the component file
 * only exports the component.
 */

/** user-space box of the artwork (its baseline sits at y 204); the lockup uses the ratio to size it */
export const COLLECTIVE_VIEWBOX = { width: 899, height: 216 } as const;
/** stroke width in user units — must be the same in the resting lockup and the intro so nothing jumps when drawing completes */
export const COLLECTIVE_STROKE = 8;

/** where the pen lifts off: the end of the final flourish, in user space */
export const COLLECTIVE_TAIL = { x: 891, y: 181 } as const;
