/**
 * Metrics of the "Collective" script artwork (see CollectiveScript.tsx).
 * Kept in a plain module so the component file only exports components
 * (react-refresh); CollectiveScript re-exports them.
 */

/** user-space box of the artwork; the lockup uses the ratio to size it */
export const COLLECTIVE_VIEWBOX = { width: 899, height: 216 } as const;
/** baseline y in user space, so the lockup can align it under the wordmark */
export const COLLECTIVE_BASELINE = 204;
/** stroke width in user units — must be the same in the resting lockup and the intro so nothing jumps when drawing completes */
export const COLLECTIVE_STROKE = 8;

/** where the pen lifts off: the end of the final flourish, in user space */
export const COLLECTIVE_TAIL = { x: 891, y: 181 } as const;
