import { Dialog } from "radix-ui";
import { useState, type MouseEvent } from "react";

import GMark from "@/marks/GMark";
import { STACK, navMark, pill, serif } from "@/theme/classes";
import { NAV_MARK_SIZE } from "@/theme/measures";
import type { SectionId } from "@/content/site";
import { useSite } from "@/content/useSite";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/state/appStore";
import { revealRef } from "@/state/revealTargets";
import { CLOSE_LABEL, MENU_LABEL } from "./mobileNavLabels";
import { useNavigate } from "./useNavigate";

export type MobileNavProps = {
  className?: string;
};

/**
 * The phone and tablet nav: the G mark on the left, as the xl corner has it,
 * "Menu" on the right, and a full-screen sheet on ink with every nav link plus Give and
 * Join Sunday. Escape, the Close button, and any link close it. The current
 * section's link in the sheet is marked current, off the store.
 */
export default function MobileNav({ className }: MobileNavProps) {
  const site = useSite();
  const activeId = useAppStore((s) => s.activeId);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  /** a link in the sheet: the sheet closes, then the jump */
  const go = (id: SectionId) => {
    const jump = navigate(id);
    return (e: MouseEvent<HTMLAnchorElement>) => {
      setOpen(false);
      jump(e);
    };
  };

  return (
    <div className={cn("flex w-full items-center justify-between", className)}>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger asChild>
          <button
            type="button"
            className={pill({ intent: "menu" })}
          >
            {MENU_LABEL}
          </button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Content
            aria-describedby={undefined}
            className={`fixed inset-0 ${STACK.cover} flex flex-col overflow-y-auto bg-ink font-sans text-cream outline-none data-[state=closed]:animate-sheet-out data-[state=open]:animate-sheet-in`}
          >
            <Dialog.Title className="sr-only">{MENU_LABEL}</Dialog.Title>

            {/* the same row as the resting nav — Menu/Close on the left, the G at the right corner as the xl nav has it — so the mark does not jump when the sheet opens */}
            <div className="flex items-center justify-between px-[calc(var(--spacing-frame-inset)+clamp(16px,3.4vw,34px))] pt-[calc(var(--spacing-frame-inset)+clamp(16px,2.6vw,26px))]">
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label={CLOSE_LABEL}
                  className={pill({ intent: "close" })}
                >
                  Close
                </button>
              </Dialog.Close>
              {/* not a reveal target: the sheet is never open while the intro plays */}
              <a
                href="#hero"
                onClick={go("hero")}
                className={navMark({ seat: "bar" })}
              >
                <GMark size={NAV_MARK_SIZE} ruled title={site.name} />
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
                  onClick={go(n.id)}
                  className={cn(
                    `${serif} text-[clamp(30px,5.6svh,48px)] leading-[1.1] transition-colors`,
                    n.id === activeId ? "text-seal hover:text-seal" : "text-cream/90 hover:text-cream",
                  )}
                >
                  {n.label}
                </a>
              ))}
            </nav>

            <div className="flex items-center gap-3 px-[clamp(28px,7vw,60px)] pb-[max(clamp(28px,6svh,52px),env(safe-area-inset-bottom))]">
              <a
                href="#give"
                onClick={go("give")}
                className={pill({ intent: "ghost" })}
              >
                Give
              </a>
              <a
                href="#visit"
                onClick={go("visit")}
                className={pill({ intent: "seal" })}
              >
                Join Sunday
              </a>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {/* the bar's mark is the intro traveller's landing, as the xl corner's
          is (the handoff picks whichever is laid out) */}
      <a
        ref={revealRef("mark")}
        href="#hero"
        onClick={go("hero")}
        className={navMark({ seat: "bar" })}
      >
        <GMark size={NAV_MARK_SIZE} ruled title={site.name} />
      </a>

    </div>
  );
}
