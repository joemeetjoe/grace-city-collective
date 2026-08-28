import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Lockup from "@/components/Lockup";
import IntroSplash from "./IntroSplash";
import { buildHandoff } from "./handoff";
import { buildIntroTimeline } from "./timeline";

function stubFontSize(px: number) {
  const real = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((el, pseudo) => {
    const style = real(el, pseudo);
    if ((el as HTMLElement).dataset?.lockup === "wordmark") {
      Object.defineProperty(style, "fontSize", { value: `${px}px`, configurable: true });
    }
    return style;
  });
}

/** builders that hand their timelines back to the test so it can scrub them */
function capture() {
  const built: gsap.core.Timeline[] = [];
  const build: typeof buildIntroTimeline = (targets, beats, vars) => {
    const tl = buildIntroTimeline(targets, beats, vars);
    built.push(tl);
    return tl;
  };
  const handoffs: gsap.core.Timeline[] = [];
  const handoff: typeof buildHandoff = (ctx) => {
    const tl = buildHandoff(ctx);
    handoffs.push(tl);
    return tl;
  };
  return { build, tl: () => built[0], handoff, handoffs };
}

/** the hero lockup and the parallax scene the splash hands off to */
function Stage() {
  return (
    <>
      <div data-parallax="" />
      <div data-parallax-front="" />
      <div data-hero-lockup="">
        <Lockup />
      </div>
    </>
  );
}

afterEach(() => vi.restoreAllMocks());

describe("IntroSplash", () => {
  it("covers the viewport on ink and shows the centred lockup as a title card", () => {
    stubFontSize(120);
    const { container } = render(<IntroSplash ready={false} onDone={() => {}} />);
    const splash = container.querySelector("[data-intro-splash]") as HTMLElement;
    expect(splash).not.toBeNull();
    expect(splash.className).toMatch(/fixed/);
    expect(splash.className).toMatch(/bg-ink/);
    expect(screen.getByText("Grace City")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Collective", hidden: true })).toBeTruthy();
  });

  it("hands the script and seal to the timeline on the very first build", () => {
    stubFontSize(0); // an unmeasured layout — the splash must not depend on measurement
    const seen: Array<{ script: boolean; seal: boolean }> = [];
    const build: typeof buildIntroTimeline = (targets, beats, vars) => {
      seen.push({ script: !!targets.script, seal: !!targets.seal });
      return buildIntroTimeline(targets, beats, vars);
    };
    render(<IntroSplash ready onDone={() => {}} build={build} />);
    expect(seen[0]).toEqual({ script: true, seal: true });
  });

  it("exposes the labelled slots for the handwriting and seal beats", () => {
    stubFontSize(120);
    const { build, tl } = capture();
    render(<IntroSplash ready={false} onDone={() => {}} build={build} />);
    expect(Object.keys(tl().labels)).toEqual(expect.arrayContaining(["wordmark", "collective", "seal"]));
  });

  it("does not hand off when the intro finishes before the textures are in", () => {
    stubFontSize(120);
    const { build, tl, handoff, handoffs } = capture();
    const onDone = vi.fn();
    render(<IntroSplash ready={false} onDone={onDone} build={build} handoff={handoff} />);
    act(() => {
      tl().progress(1);
    });
    expect(handoffs).toHaveLength(0);
    expect(onDone).not.toHaveBeenCalled();
  });

  it("does not hand off when the textures arrive before the intro has finished", () => {
    stubFontSize(120);
    const { build, handoff, handoffs } = capture();
    const onDone = vi.fn();
    const { rerender } = render(<IntroSplash ready={false} onDone={onDone} build={build} handoff={handoff} />);
    rerender(<IntroSplash ready onDone={onDone} build={build} handoff={handoff} />);
    expect(handoffs).toHaveLength(0);
    expect(onDone).not.toHaveBeenCalled();
  });

  it("hands the lockup off to the hero once the intro has run and the textures are in", () => {
    stubFontSize(120);
    const { build, tl, handoff, handoffs } = capture();
    const onDone = vi.fn();
    const { rerender } = render(
      <>
        <Stage />
        <IntroSplash ready={false} onDone={onDone} build={build} handoff={handoff} />
      </>,
    );
    act(() => {
      tl().progress(1);
    });
    rerender(
      <>
        <Stage />
        <IntroSplash ready onDone={onDone} build={build} handoff={handoff} />
      </>,
    );
    expect(handoffs).toHaveLength(1);
    expect(onDone).not.toHaveBeenCalled();
    act(() => {
      handoffs[0].progress(1);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("leaves the hero lockup in its resting state once the handoff has finished and the splash is gone", () => {
    stubFontSize(120);
    // distinct geometry for the two lockups, so Flip has a real transform to animate (and to leak)
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      const inSplash = !!this.closest("[data-intro-splash]");
      const r = inSplash ? { x: 400, y: 300, width: 600, height: 160 } : { x: 20, y: 700, width: 300, height: 80 };
      return { ...r, top: r.y, left: r.x, right: r.x + r.width, bottom: r.y + r.height, toJSON: () => r } as DOMRect;
    });
    const { build, tl, handoff, handoffs } = capture();
    let done = false;
    const { rerender, unmount } = render(
      <>
        <Stage />
        <IntroSplash ready={false} onDone={() => (done = true)} build={build} handoff={handoff} />
      </>,
    );
    act(() => {
      tl().progress(1);
    });
    rerender(
      <>
        <Stage />
        <IntroSplash ready onDone={() => (done = true)} build={build} handoff={handoff} />
      </>,
    );
    act(() => {
      handoffs[0].progress(1);
    });
    expect(done).toBe(true);
    unmount(); // App removes the splash once it's done
    const hero = document.querySelector("[data-hero-lockup]");
    // Stage was unmounted too; re-render just the hero to inspect what the handoff left on it
    expect(hero).toBeNull();
    for (const part of handoffs[0].getChildren(true, true, false)) {
      for (const target of part.targets() as unknown[]) {
        if (!(target instanceof Element) || target.closest("[data-intro-splash]")) continue;
        const style = (target as HTMLElement).style;
        expect(style.transform, `${target.getAttribute("data-flip-id")} transform`).toBe("");
        expect(style.position, `${target.getAttribute("data-flip-id")} position`).toBe("");
      }
    }
  });

  it("hands off only once even as the gate inputs keep changing", () => {
    stubFontSize(120);
    const { build, tl, handoff, handoffs } = capture();
    const onDone = vi.fn();
    const { rerender } = render(<IntroSplash ready onDone={onDone} build={build} handoff={handoff} />);
    act(() => {
      tl().progress(1);
    });
    rerender(<IntroSplash ready skipped onDone={onDone} build={build} handoff={handoff} />);
    expect(handoffs).toHaveLength(1);
  });

  it("a skipped splash with textures in hands off without waiting out the intro", () => {
    stubFontSize(120);
    const { build, tl, handoff, handoffs } = capture();
    const onDone = vi.fn();
    const { rerender } = render(<IntroSplash ready={false} onDone={onDone} build={build} handoff={handoff} />);
    rerender(<IntroSplash ready skipped onDone={onDone} build={build} handoff={handoff} />);
    expect(handoffs).toHaveLength(1);
    // the intro is jumped to its resting state so the lockup is whole when it travels
    expect(tl().progress()).toBe(1);
    act(() => {
      handoffs[0].progress(1);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("a skip before the textures are in still waits on ink", () => {
    stubFontSize(120);
    const { build, handoff, handoffs } = capture();
    const { rerender } = render(<IntroSplash ready={false} onDone={() => {}} build={build} handoff={handoff} />);
    rerender(<IntroSplash ready={false} skipped onDone={() => {}} build={build} handoff={handoff} />);
    expect(handoffs).toHaveLength(0);
  });

  it("holds the parallax on ink while mounted and fades it up through the handoff", () => {
    stubFontSize(120);
    const { build, tl, handoff, handoffs } = capture();
    const { rerender, unmount } = render(
      <>
        <Stage />
        <IntroSplash ready={false} onDone={() => {}} build={build} handoff={handoff} />
      </>,
    );
    const parallax = document.querySelector("[data-parallax]") as HTMLElement;
    const front = document.querySelector("[data-parallax-front]") as HTMLElement;
    expect(parallax.style.opacity).toBe("0");
    expect(front.style.opacity).toBe("0");
    act(() => {
      tl().progress(1);
    });
    rerender(
      <>
        <Stage />
        <IntroSplash ready onDone={() => {}} build={build} handoff={handoff} />
      </>,
    );
    act(() => {
      handoffs[0].progress(1);
    });
    expect(parallax.style.opacity).toBe("1");
    expect(front.style.opacity).toBe("1");
    unmount();
    expect(parallax.style.opacity).toBe("");
    expect(front.style.opacity).toBe("");
  });

  describe("skip gesture", () => {
    function mountSkippable(ready = true) {
      const { build, tl, handoff, handoffs } = capture();
      const onDone = vi.fn();
      const view = render(
        <>
          <Stage />
          <IntroSplash ready={ready} onDone={onDone} build={build} handoff={handoff} />
        </>,
      );
      return { ...view, tl, handoff, handoffs, onDone, build };
    }

    it("a click during the splash jumps to the end and, with textures in, hands off", () => {
      stubFontSize(120);
      const { tl, handoffs, onDone } = mountSkippable();
      expect(tl().progress()).toBeLessThan(1);
      act(() => {
        fireEvent.pointerDown(window);
      });
      expect(tl().progress()).toBe(1);
      expect(handoffs).toHaveLength(1);
      act(() => {
        handoffs[0].progress(1);
      });
      expect(onDone).toHaveBeenCalledTimes(1);
    });

    it("a keypress does the same", () => {
      stubFontSize(120);
      const { tl, handoffs, onDone } = mountSkippable();
      act(() => {
        fireEvent.keyDown(window, { key: "Enter" });
      });
      expect(tl().progress()).toBe(1);
      expect(handoffs).toHaveLength(1);
      act(() => {
        handoffs[0].progress(1);
      });
      expect(onDone).toHaveBeenCalledTimes(1);
    });

    it("a wheel scroll does the same", () => {
      stubFontSize(120);
      const { tl, handoffs, onDone } = mountSkippable();
      act(() => {
        fireEvent.wheel(window, { deltaY: 40 });
      });
      expect(tl().progress()).toBe(1);
      expect(handoffs).toHaveLength(1);
      act(() => {
        handoffs[0].progress(1);
      });
      expect(onDone).toHaveBeenCalledTimes(1);
    });

    it("a touch scroll does the same", () => {
      stubFontSize(120);
      const { tl, handoffs } = mountSkippable();
      act(() => {
        fireEvent.touchMove(window);
      });
      expect(tl().progress()).toBe(1);
      expect(handoffs).toHaveLength(1);
    });

    it("a skip before the textures are in does not hand off until ready flips", () => {
      stubFontSize(120);
      const { tl, handoffs, onDone, rerender, build, handoff } = mountSkippable(false);
      act(() => {
        fireEvent.pointerDown(window);
      });
      expect(tl().progress()).toBe(1);
      expect(handoffs).toHaveLength(0);
      rerender(
        <>
          <Stage />
          <IntroSplash ready onDone={onDone} build={build} handoff={handoff} />
        </>,
      );
      expect(handoffs).toHaveLength(1);
      act(() => {
        handoffs[0].progress(1);
      });
      expect(onDone).toHaveBeenCalledTimes(1);
    });

    it("gesture listeners are gone after unmount", () => {
      stubFontSize(120);
      const { handoffs, onDone, unmount } = mountSkippable(false);
      unmount();
      expect(() => {
        fireEvent.pointerDown(window);
        fireEvent.keyDown(window, { key: " " });
        fireEvent.wheel(window);
      }).not.toThrow();
      expect(handoffs).toHaveLength(0);
      expect(onDone).not.toHaveBeenCalled();
    });

    it("writes the session flag when the gate opens", () => {
      stubFontSize(120);
      window.sessionStorage.removeItem("gcc:intro-played");
      const { handoffs } = mountSkippable();
      expect(window.sessionStorage.getItem("gcc:intro-played")).toBeNull();
      act(() => {
        fireEvent.pointerDown(window);
      });
      expect(handoffs).toHaveLength(1);
      expect(window.sessionStorage.getItem("gcc:intro-played")).not.toBeNull();
      window.sessionStorage.removeItem("gcc:intro-played");
    });
  });

  it("leaves the parallax untouched when the splash is never mounted", () => {
    render(<div data-parallax="" />);
    const parallax = document.querySelector("[data-parallax]") as HTMLElement;
    expect(parallax.style.opacity).toBe("");
  });
});
