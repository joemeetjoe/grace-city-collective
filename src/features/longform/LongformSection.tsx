import type { ReactNode } from "react";

import type { LongformId } from "@/content/site";
import { useSite } from "@/content/useSite";
import { kicker, longformContainer, longformHeading } from "@/theme/classes";
import SectionRule from "@/ui/panel/SectionRule";
import Reveal from "@/ui/Reveal";
import { sectionById } from "./section";

/** the header as a plain column; a section narrows it, or gives it a column of the row */
const HEADER = "flex flex-col gap-5";

type Props = {
  id: LongformId;
  /** the container's classes after `longformContainer`: its gap, and the FAQ's row at md */
  className: string;
  /** the header's classes in place of the plain column: a max width, or the FAQ's third */
  headerClassName?: string;
  /** what the heading says when not the section's own: Messages sets the series under its label */
  heading?: ReactNode;
  children: ReactNode;
};

/**
 * The scaffold of a long-form section: its opening rule, then the container
 * with a revealed header — the kicker, the heading and, where the content
 * gives one, the intro — over the section's own body. The section element
 * itself belongs to the shell (LongformGate.tsx); this fills it.
 */
export default function LongformSection({ id, className, headerClassName = HEADER, heading, children }: Props) {
  const section = sectionById(useSite(), id);
  return (
    <>
      <SectionRule />
      <div className={`${longformContainer} ${className}`}>
        <Reveal as="header" className={headerClassName}>
          <p className={kicker}>{section.kicker}</p>
          <h2 className={longformHeading}>{heading ?? section.heading}</h2>
          {section.intro && (
            <p className="text-lg leading-relaxed text-pretty text-cream/75">{section.intro}</p>
          )}
        </Reveal>
        {children}
      </div>
    </>
  );
}
