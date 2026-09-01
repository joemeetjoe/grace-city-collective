import { BUTTON_CORNERS, GLASS } from "@/theme/glass";
import { Dialog } from "radix-ui";
import { useState } from "react";

import GMark from "@/components/GMark";
import { site } from "@/content/site";
import { cn } from "@/lib/utils";

export const MENU_LABEL = "Menu";
export const CLOSE_LABEL = "Close menu";
/** the mark's height: the same G as the xl corner's, so the intro's traveller lands on one size everywhere */
export const MARK_SIZE = 40;

const serif = "[font-family:'Cormorant_Garamond',Georgia,serif]";
const pill = `${BUTTON_CORNERS} px-[22px] py-[13px] text-[11px] uppercase tracking-[0.18em] transition-colors`;
/** the mark's seat: the same padding in the bar and the sheet, so it never jumps when the sheet opens */
const seat = `${BUTTON_CORNERS} inline-flex p-1.5 text-cream`;
// over the scene the bar carries no backdrop of its own (App.tsx), so Menu
// wears the desktop links' frosted glass (#60); the mark stays bare — its
// own box is enough of a seat. The sheet is solid ink; Close stays bare there.
const glassPill = `${pill} ${GLASS}`;

export type MobileNavProps = {
  /** the section under the viewport's midpoint; its link in the sheet is marked current */
  activeId?: string | null;
  /** a link was chosen; the caller scrolls (the sheet has already closed) */
  onNavigate?: (id: string) => void;
  className?: string;
};

/**
 * The phone and tablet nav: the G mark on the left, as the xl corner has it,
 * "Menu" on the right, and a full-screen sheet on ink with every nav link plus Give and
 * Join Sunday. Escape, the Close button, and any link close it.
 */
export default function MobileNav({
  activeId = null,
  onNavigate,
  className,
}: MobileNavProps) {
  const [open, setOpen] = useState(false);

  const go = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    setOpen(false);
    onNavigate?.(id);
  };

  return (
    <div
      data-mobile-nav=""
      className={cn("flex w-full items-center justify-between", className)}
    >
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger asChild>
          <button
            type="button"
            className={`${glassPill} cursor-pointer text-cream/85 hover:text-cream`}
          >
            {MENU_LABEL}
          </button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Content
            data-nav-sheet=""
            aria-describedby={undefined}
            className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-ink font-sans text-cream outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-300"
          >
            <Dialog.Title className="sr-only">{MENU_LABEL}</Dialog.Title>

            {/* the same row as the resting nav — Menu/Close on the left, the G at the right corner as the xl nav has it — so the mark does not jump when the sheet opens */}
            <div className="flex items-center justify-between px-[calc(clamp(9px,2.4vw,26px)+clamp(16px,3.4vw,34px))] pt-[calc(clamp(9px,2.4vw,26px)+clamp(16px,2.6vw,26px))]">
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label={CLOSE_LABEL}
                  className={`${pill} cursor-pointer text-cream/85 hover:text-cream`}
                >
                  Close
                </button>
              </Dialog.Close>
              {/* no data-nav-mark here: the sheet is never open while the intro plays */}
              <a
                href="#hero"
                onClick={(e) => go(e, "hero")}
                className={seat}
              >
                <GMark size={MARK_SIZE} ruled title={site.name} />
              </a>
            </div>

            <nav
              aria-label="Site"
              className="flex flex-1 flex-col justify-center gap-[clamp(6px,1.4svh,14px)] px-[clamp(28px,7vw,60px)] py-8"
            >
              {site.nav.map((n) => (
                <a
                  key={n.id}
                  href={`#${n.id}`}
                  aria-current={n.id === activeId ? "location" : undefined}
                  onClick={(e) => go(e, n.id)}
                  className={cn(
                    `${serif} text-[clamp(30px,5.6svh,48px)] leading-[1.1] text-cream/90 transition-colors hover:text-cream`,
                    n.id === activeId && "text-seal hover:text-seal",
                  )}
                >
                  {n.label}
                </a>
              ))}
            </nav>

            <div className="flex items-center gap-3 px-[clamp(28px,7vw,60px)] pb-[max(clamp(28px,6svh,52px),env(safe-area-inset-bottom))]">
              <a
                href="#give"
                onClick={(e) => go(e, "give")}
                className={`${pill} border border-cream/45 hover:border-cream hover:bg-cream/10`}
              >
                Give
              </a>
              <a
                href="#visit"
                onClick={(e) => go(e, "visit")}
                className={`${pill} bg-seal font-bold text-cream hover:bg-seal-deep`}
              >
                Join Sunday
              </a>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {/* the mark carries data-nav-mark: the intro's traveller lands on it, as
          on the xl corner's (IntroSplash picks whichever is laid out) */}
      <a
        href="#hero"
        data-nav-mark=""
        onClick={(e) => go(e, "hero")}
        className={seat}
      >
        <GMark size={MARK_SIZE} ruled title={site.name} />
      </a>

    </div>
  );
}
