/** a section on the page, by id and element */
export type WatchedSection = { id: string; el: HTMLElement };

/**
 * The page's sections as refs. The components that render a section mount
 * it with `ref(id)` (the stops, the long-form gate); whoever needs the
 * elements — the section watch, the pager, the engine's camera waypoints —
 * reads `sections()` once mounted, in the order the ids were given. No
 * selector: the registry is the one place the DOM and the modules over it
 * agree on which element a section is.
 */
export type SectionRegistry = {
  /** the callback ref a section mounts with; the same function for the same id */
  ref(id: string): (el: HTMLElement | null) => void;
  /** the sections on the page, in `order`; an id with no element yet is skipped */
  sections(): WatchedSection[];
};

export function createSectionRegistry(order: readonly string[]): SectionRegistry {
  const els = new Map<string, HTMLElement>();
  const refs = new Map<string, (el: HTMLElement | null) => void>();
  return {
    ref(id) {
      let ref = refs.get(id);
      if (!ref) {
        ref = (el) => {
          if (el) els.set(id, el);
          else els.delete(id);
        };
        refs.set(id, ref);
      }
      return ref;
    },
    sections: () =>
      order.flatMap((id) => {
        const el = els.get(id);
        return el ? [{ id, el }] : [];
      }),
  };
}
