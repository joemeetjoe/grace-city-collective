import { useState, type RefCallback } from "react";

/**
 * The scene sections by ref (#120): each stop's <section> lands in a slot as
 * it mounts, and whoever paces against them — the engine's camera, a scroll
 * pager — reads the list rather than querying the DOM. One registry per
 * mount (useSceneLayers), created once so its callback refs are stable.
 */
export type SectionRefs = {
  /** the callback ref for the section at `index`, the same function every render */
  at(index: number): RefCallback<HTMLElement>;
  /** the mounted sections in page order */
  readonly current: readonly HTMLElement[];
};

export function createSectionRefs(): SectionRefs {
  const slots: (HTMLElement | null)[] = [];
  const callbacks = new Map<number, RefCallback<HTMLElement>>();
  return {
    at(index) {
      let cb = callbacks.get(index);
      if (!cb) {
        cb = (el) => {
          slots[index] = el;
        };
        callbacks.set(index, cb);
      }
      return cb;
    },
    get current() {
      return slots.filter((el): el is HTMLElement => el != null);
    },
  };
}

export function useSectionRefs(): SectionRefs {
  return useState(createSectionRefs)[0];
}
