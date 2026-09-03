/**
 * The long-form chunk: Devotions, Beliefs, FAQ, Messages and the footer sit
 * several viewports below the scene, so their code leaves the shell and is
 * requested behind the in-view trigger in LongformGate.tsx, or by a nav
 * jump to one of them (#111). One dynamic import, one chunk.
 */
export const loadLongform = () => import("./Longform");
