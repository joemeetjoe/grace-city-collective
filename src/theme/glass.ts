/**
 * Lightly frosted glass, shared by the scene's copy panels, the nav and the
 * dot rail: a faint ink tint and a light blur, so the scene's flames, rays
 * and figures show through, with a hairline edge.
 */
export const GLASS =
  "bg-ink/15 backdrop-blur-md backdrop-saturate-125 border border-cream/10";

/** the G mark's shape at a small radius: rounded top-left and bottom-right only */
export const GLASS_CORNERS =
  "rounded-tl-[clamp(14px,1.6vw,22px)] rounded-br-[clamp(14px,1.6vw,22px)]";

/** the same shape on a button: rounded top-left and bottom-right at a button's scale */
export const BUTTON_CORNERS = "rounded-tl-[12px] rounded-br-[12px]";
