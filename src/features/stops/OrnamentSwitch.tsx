import type { ReactNode } from "react";

import { FOCUS_RING } from "@/theme/classes";
import { cn } from "@/lib/utils";

export type OrnamentSwitchProps = {
  /** what the switch is called: the ornament's line from the content (chromeWords) */
  label: string;
  /** whether the drawing is lit by the switch, as aria-pressed says */
  pressed: boolean;
  onPress: () => void;
  /** the drawing's box: the switch takes the classes the drawing wore, and the drawing fills it */
  className?: string;
  children: ReactNode;
};

/**
 * The keyboard's and a touch's way to a hover-lit ornament (#130): a toggle
 * button around the drawing, named from the content and saying whether it
 * is pressed, so a press — Enter, Space, a tap — lights the drawing the way
 * the pointer over its panel does, and holds it lit until the next. No box
 * of its own: it wears the drawing's classes, and the drawing inside fills
 * it, so the pixels stay where they were; only the theme's focus ring is new.
 */
export default function OrnamentSwitch({ label, pressed, onPress, className, children }: OrnamentSwitchProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onPress}
      className={cn("block", FOCUS_RING, className)}
    >
      {children}
    </button>
  );
}
