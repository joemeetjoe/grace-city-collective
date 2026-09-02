import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { site } from "@/content/site";
import { BELOW_LG_QUERY } from "@/theme/breakpoints";
import { useAppStore } from "@/state/appStore";
import { EMBLEM_LIT_STEP_MS, ORNAMENT_LIT_AT_MS } from "@/theme/motion";
import Scene from "./Scene";

/**
 * The stops' DOM, pinned (#121): every scene section's markup, in every
 * state a stop can stand in without the browser — at rest and lit, from lg
 * up and below, the hero with the splash still up — serialised to a file
 * under __snapshots__/scene-dom. A refactor of the stops' scaffold must
 * leave every one of them byte-identical: the same elements in the same
 * order with the same attributes and the same set of classes. Class order
 * within an attribute is the one thing normalised (sorted, single-spaced):
 * a stylesheet reads a class list as a set, so its order says nothing
 * about the pixels, and a scaffold is free to build the list differently.
 *
 * jsdom has no IntersectionObserver, so every panel reports its initial
 * answer (shown); below lg the ornaments then play on timers, which the
 * lit state runs out under fake timers. The desktop's lit state is the
 * pointer over the panel, and over the first gathering.
 */

const LIT_SETTLE_MS = ORNAMENT_LIT_AT_MS + EMBLEM_LIT_STEP_MS * 3 + 1;

function pin(container: HTMLElement): string {
  const clone = container.cloneNode(true) as HTMLElement;
  for (const el of clone.querySelectorAll("[class]")) {
    const sorted = el.getAttribute("class")!.split(/\s+/).filter(Boolean).sort().join(" ");
    el.setAttribute("class", sorted);
  }
  return `${clone.innerHTML.replace(/></g, ">\n<")}\n`;
}

function matchMedia(below: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
    matches: below && query === BELOW_LG_QUERY,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }));
}

const file = (id: string, device: string, state: string) =>
  `./__snapshots__/scene-dom/${id}.${device}.${state}.html`;

describe("the scene sections' DOM", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    useAppStore.setState({ intro: false });
  });

  for (const s of site.scene) {
    it(`${s.id} from lg up, at rest and under the pointer`, async () => {
      matchMedia(false);
      const { container } = render(<Scene section={s} />);
      const rest = pin(container);
      await expect(rest).toMatchFileSnapshot(file(s.id, "desktop", "rest"));
      const panel = container.querySelector("[data-copy-panel]");
      const card = container.querySelector("[data-gathering]");
      if (panel) fireEvent.mouseEnter(panel);
      if (card) fireEvent.mouseEnter(card);
      await expect(pin(container)).toMatchFileSnapshot(file(s.id, "desktop", "lit"));
      if (card) fireEvent.mouseLeave(card);
      if (panel) fireEvent.mouseLeave(panel);
      expect(pin(container)).toBe(rest);
    });

    it(`${s.id} below lg, at rest and once settled`, async () => {
      matchMedia(true);
      const { container } = render(<Scene section={s} />);
      await expect(pin(container)).toMatchFileSnapshot(file(s.id, "phone", "rest"));
      act(() => vi.advanceTimersByTime(LIT_SETTLE_MS));
      await expect(pin(container)).toMatchFileSnapshot(file(s.id, "phone", "lit"));
    });
  }

  it("the hero with the splash still up", async () => {
    matchMedia(false);
    useAppStore.setState({ intro: true });
    const hero = site.scene.find((s) => s.id === "hero")!;
    const { container } = render(<Scene section={hero} />);
    await expect(pin(container)).toMatchFileSnapshot(file("hero", "desktop", "pending"));
  });
});
