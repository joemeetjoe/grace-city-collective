/** a section's position, as far as the active state cares: its id and where it starts */
export type SectionBox<Id extends string = string> = { id: Id; top: number };

/**
 * The section under a point — the viewport's midpoint — given the sections in
 * page order. The first section owns everything above it, the last everything
 * below, and a gap between two goes to the one above. Pure: the hook feeds it
 * rects, the tests feed it numbers.
 */
export function activeSection<Id extends string>(midpointY: number, sections: readonly SectionBox<Id>[]): Id | null {
  if (sections.length === 0) return null;
  let current = sections[0];
  for (const s of sections) {
    if (s.top <= midpointY) current = s;
    else break;
  }
  return current.id;
}
