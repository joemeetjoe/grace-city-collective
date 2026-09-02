/** The corner brackets' measures (CornerOrnaments.tsx): arm lengths, insets and the entrance. */

/** the scene frame's brackets: inside the cream line (--spacing-frame-inset, index.css), long arms */
export const FRAME_ARM = "clamp(72px,9vw,150px)";
export const FRAME_INSET = "calc(var(--spacing-frame-inset) + 12px)";

/** a copy block's brackets: at the block's padding edge, shorter arms */
export const COPY_ARM = "clamp(44px,5.5vw,90px)";

/** how far out from its corner a waiting bracket sits, in px */
export const ENTER_OFFSET = 56;
/** how much of its length a waiting arm has grown */
export const ENTER_SCALE = 0.55;
