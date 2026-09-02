import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BELOW_LG_QUERY } from "@/theme/breakpoints";
import { useAppStore } from "@/state/appStore";
import Bracketed from "@/ui/panel/Bracketed";
import { EMBLEM_LIT_STEP_MS, ORNAMENT_LIT_AT_MS } from "@/theme/motion";
import { useStopPanel } from "./useStopPanel";

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

/** a stop reduced to what the hook answers: the panel it watches, and the lights */
function Probe({ count = 1 }: { count?: number }) {
  const { panel, hover, shown, lit, belowLg, inTurn } = useStopPanel(count);
  return (
    <Bracketed {...panel} {...hover}>
      <span
        data-probe=""
        data-shown={String(shown)}
        data-lit={String(lit)}
        data-below={String(belowLg)}
        data-in-turn={inTurn}
      />
    </Bracketed>
  );
}

const probe = (container: HTMLElement) => container.querySelector<HTMLElement>("[data-probe]")!;
const panelOf = (container: HTMLElement) => container.querySelector<HTMLElement>("[data-copy-panel]")!;

describe("useStopPanel (#121): what lights the ornament, decided once", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    useAppStore.setState({ reducedMotion: false });
  });

  it("from lg up the pointer over the panel lights it, and nothing plays on a timer", () => {
    matchMedia(false);
    const { container } = render(<Probe />);
    const el = probe(container);
    // jsdom has no IntersectionObserver: the panel reports its initial answer, shown
    expect(el.dataset.shown).toBe("true");
    expect(el.dataset.below).toBe("false");
    expect(el.dataset.lit).toBe("false");
    act(() => vi.advanceTimersByTime(ORNAMENT_LIT_AT_MS * 2));
    expect(el.dataset.lit).toBe("false");
    expect(el.dataset.inTurn).toBe("0");
    fireEvent.mouseEnter(panelOf(container));
    expect(el.dataset.lit).toBe("true");
    fireEvent.mouseLeave(panelOf(container));
    expect(el.dataset.lit).toBe("false");
  });

  it("below lg the settle lights it a beat after the panel is in, whatever the pointer does, and the pieces in turn", () => {
    matchMedia(true);
    const { container } = render(<Probe count={3} />);
    const el = probe(container);
    expect(el.dataset.shown).toBe("true");
    expect(el.dataset.below).toBe("true");
    expect(el.dataset.lit).toBe("false");
    fireEvent.mouseEnter(panelOf(container));
    expect(el.dataset.lit).toBe("false");
    act(() => vi.advanceTimersByTime(ORNAMENT_LIT_AT_MS));
    expect(el.dataset.lit).toBe("true");
    expect(el.dataset.inTurn).toBe("1");
    act(() => vi.advanceTimersByTime(EMBLEM_LIT_STEP_MS * 2));
    expect(el.dataset.inTurn).toBe("3");
    fireEvent.mouseLeave(panelOf(container));
    expect(el.dataset.lit).toBe("true");
  });

  it("under reduced motion below lg the panel is shown and the ornament rests", () => {
    matchMedia(true);
    useAppStore.setState({ reducedMotion: true });
    const { container } = render(<Probe />);
    const el = probe(container);
    expect(el.dataset.shown).toBe("true");
    act(() => vi.advanceTimersByTime(ORNAMENT_LIT_AT_MS * 2));
    expect(el.dataset.lit).toBe("false");
    expect(el.dataset.inTurn).toBe("0");
  });
});
