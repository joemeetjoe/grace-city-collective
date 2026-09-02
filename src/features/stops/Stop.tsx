import type { ReactNode, Ref } from "react";

import type { SceneSection } from "@/content/site";
import Bracketed from "@/ui/panel/Bracketed";
import { TUCK, stopFrame } from "@/theme/classes";

/** a stop's props: its words from site.ts, and the ref its <section> lands in (scroll/sectionRefs.ts) */
export type StopProps = { section: SceneSection; ref?: Ref<HTMLElement> };

/** a stop's copy panel as useStopPanel watches it: the element to watch, and whether it is shown */
export type PanelWatch = { ref: Ref<HTMLDivElement>; shown: boolean };

/** the pointer's arrival and departure, for a panel lit as a whole while the reader is over it (useHoverLit) */
export type HoverHandlers = { onMouseEnter: () => void; onMouseLeave: () => void };

/**
 * The scaffold every stop stands in (#121): its section — one viewport of
 * the scene on desktop, as tall as its words below lg (stopFrame) — and,
 * for every stop but the hero, the copy panel its words stand in
 * (Bracketed), tucked behind the nearest figures where the stop's tuck
 * says (TUCK, keyed by the section id). The stop's own alignment and
 * padding follow the frame's classes on the section, the panel's own
 * follow the glass's; the tuck comes last.
 */
export default function Stop({
  section: s,
  ref,
  className = "",
  clear = true,
  panel,
  panelClassName = "",
  hover,
  children,
}: StopProps & {
  /** the section's own utilities after its frame: alignment, and the per-stop padding */
  className?: string;
  /** keep clear of the seal row and the lockup below lg (stopFrame's `clear`); the hero pads its own way */
  clear?: boolean;
  /** the copy panel the words stand in, as useStopPanel watches it; none for the hero, whose headline stands bare on the scene */
  panel?: PanelWatch;
  /** the panel's own utilities: its width and how its children flow */
  panelClassName?: string;
  /** light the panel as a whole while the reader is over it (useStopPanel's `hover`) */
  hover?: HoverHandlers;
  children: ReactNode;
}) {
  const frame = stopFrame(s.id);
  return (
    <section
      ref={ref}
      id={s.id}
      data-screen-label={s.label}
      className={`${frame.base} ${clear ? frame.clear : ""} ${className}`}
    >
      {panel ? (
        <Bracketed
          {...panel}
          {...hover}
          className={`${panelClassName} ${TUCK[s.id] ?? ""}`}
        >
          {children}
        </Bracketed>
      ) : (
        children
      )}
    </section>
  );
}
