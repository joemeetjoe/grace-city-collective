import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import GMark from "@/marks/GMark";
import { gsap } from "@/lib/gsap";
import { site } from "@/content/site";
import IntroSplash from "./IntroSplash";
import { NAV_MARK, buildHandoff, navMark } from "./handoff";
import { HERO_SETTLE_PX } from "./heroRise";
import { SPLASH_MARK_SIZE } from "./splashMark";
import { LIVE_SPLASH_ATTR, SPLASH_HEADLINE_ATTR, STATIC_SPLASH_ATTR, staticSplashMarkup } from "./staticSplash";
import { TRACE_HOLD, createTrace, ruleReach } from "./trace";

/** builders that hand their timelines back to the test so it can scrub them */
function capture() {
  const built: ReturnType<typeof createTrace>[] = [];
  const build: typeof createTrace = (rule, vars) => {
    const trace = createTrace(rule, vars);
    built.push(trace);
    return trace;
  };
  const handoffs: gsap.core.Timeline[] = [];
  const handoff: typeof buildHandoff = (ctx) => {
    const tl = buildHandoff(ctx);
    handoffs.push(tl);
    return tl;
  };
  return { build, tl: () => built[0].timeline, trace: () => built[0], handoff, handoffs };
}

/** the nav mark and the parallax scene the splash hands off to */
function Stage() {
  return (
    <>
      <div data-parallax="" />
      <div data-parallax-front="" />
      <nav>
        <a href="#hero" data-nav-mark="">
          <GMark size={40} ruled />
        </a>
      </nav>
    </>
  );
}

const splashRule = () => document.querySelector<SVGPathElement>("[data-intro-splash] [data-g-mark-rule]")!;

describe("navMark", () => {
  it("picks the nav mark that is laid out, whichever breakpoint's it is", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <a data-nav-mark="" data-which="phone"><svg data-g-mark=""></svg></a>
      <a data-nav-mark="" data-which="xl"><svg data-g-mark=""></svg></a>`;
    const rect = (w: number) =>
      ({ x: 0, y: 0, width: w, height: w, top: 0, left: 0, right: w, bottom: w, toJSON: () => ({}) }) as DOMRect;
    const marks = Array.from(root.querySelectorAll<SVGSVGElement>(NAV_MARK));
    vi.spyOn(marks[0], "getBoundingClientRect").mockReturnValue(rect(0));
    vi.spyOn(marks[1], "getBoundingClientRect").mockReturnValue(rect(40));
    expect(navMark(root)?.parentElement?.dataset.which).toBe("xl");
    vi.spyOn(marks[0], "getBoundingClientRect").mockReturnValue(rect(40));
    vi.spyOn(marks[1], "getBoundingClientRect").mockReturnValue(rect(0));
    expect(navMark(root)?.parentElement?.dataset.which).toBe("phone");
    // neither laid out: no destination, so the handoff fades the mark in place
    vi.spyOn(marks[0], "getBoundingClientRect").mockReturnValue(rect(0));
    expect(navMark(root)).toBeNull();
  });
});

afterEach(() => vi.restoreAllMocks());

describe("IntroSplash", () => {
  it("covers the viewport on ink with the ruled G mark and the headline on it", () => {
    render(<IntroSplash ready={false} onDone={() => {}} />);
    const root = document.querySelector("[data-intro-splash]") as HTMLElement;
    expect(root.style.position).toBe("fixed");
    expect(root.style.inset).toBe("0px");
    expect(root.style.zIndex).toBe("50");
    const mark = root.querySelector("[data-g-mark]") as SVGSVGElement;
    expect(mark).not.toBeNull();
    // as tall as its share of the height allows, or as wide as its share of the width, whichever binds first
    expect(SPLASH_MARK_SIZE).toMatch(/^min\(\d+svh, calc\(\d+vw \/ [\d.]+\)\)$/);
    expect(mark.getAttribute("aria-hidden")).toBe("true");
    expect(root.querySelector("[data-g-mark-rule]")).not.toBeNull();
    expect(root.querySelector(`h1[${SPLASH_HEADLINE_ATTR}]`)!.textContent).toBe(site.scene[0].heading);
  });

  it("starts with the rule undrawn and lets the floor draw it out to the hold", () => {
    const { build, tl } = capture();
    render(<IntroSplash ready={false} onDone={() => {}} build={build} />);
    expect(ruleReach(splashRule())).toBe(0);
    act(() => {
      tl().progress(1);
    });
    expect(ruleReach(splashRule())).toBeCloseTo(TRACE_HOLD, 6);
  });

  it("the textures pull the rule ahead of the floor, gliding out to their share", () => {
    const { build, trace } = capture();
    const { rerender } = render(<IntroSplash ready={false} progress={0} onDone={() => {}} build={build} />);
    rerender(<IntroSplash ready={false} progress={0.5} onDone={() => {}} build={build} />);
    // nothing has moved yet: the splash has not been painted
    expect(ruleReach(splashRule())).toBe(0);
    act(() => {
      trace().start();
    });
    expect(ruleReach(splashRule())).toBe(0);
    act(() => {
      trace().glide()!.progress(1);
    });
    expect(ruleReach(splashRule())).toBeCloseTo(0.5 * TRACE_HOLD, 6);
  });

  it("starts the trace on the frame after its first paint, and not before", async () => {
    const { build, tl } = capture();
    render(<IntroSplash ready={false} onDone={() => {}} build={build} />);
    expect(tl().paused()).toBe(true);
    await act(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        }),
    );
    expect(tl().paused()).toBe(false);
  });

  it("a splash unmounted before its first frame never starts", async () => {
    const { build, tl } = capture();
    const { unmount } = render(<IntroSplash ready={false} onDone={() => {}} build={build} />);
    unmount();
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    expect(tl().paused()).toBe(true);
  });

  it("holds gsap's clock through stalls while up, and lets it go on unmount", () => {
    const spy = vi.spyOn(gsap.ticker, "lagSmoothing");
    const { unmount } = render(<IntroSplash ready={false} onDone={() => {}} />);
    expect(spy).toHaveBeenLastCalledWith(100, 16);
    unmount();
    expect(spy).toHaveBeenLastCalledWith(500, 33);
  });

  it("adopts the static splash from index.html the moment it is committed: the same root, the same h1, and takes it away on unmount", () => {
    document.body.insertAdjacentHTML("afterbegin", staticSplashMarkup());
    const stat = document.querySelector(`[${STATIC_SPLASH_ATTR}]`)!;
    const h1 = stat.querySelector(`[${SPLASH_HEADLINE_ATTR}]`)!;
    const { unmount } = render(<IntroSplash ready={false} onDone={() => {}} />);
    // nothing rebuilt: the headline that painted first is the one the splash keeps (it is the LCP element, #107)
    expect(document.querySelector(`[${LIVE_SPLASH_ATTR}]`)).toBe(stat);
    expect(stat.getAttribute("aria-hidden")).toBe("true");
    expect(document.querySelectorAll(`[${STATIC_SPLASH_ATTR}]`)).toHaveLength(1);
    expect(document.querySelector(`[${SPLASH_HEADLINE_ATTR}]`)).toBe(h1);
    expect(document.querySelectorAll("h1")).toHaveLength(1);
    unmount();
    expect(document.querySelector(`[${STATIC_SPLASH_ATTR}]`)).toBeNull();
    expect(document.querySelector(`[${LIVE_SPLASH_ATTR}]`)).toBeNull();
  });

  it("does not hand off when the floor finishes before the textures are in", () => {
    const { build, tl, handoff, handoffs } = capture();
    render(<IntroSplash ready={false} onDone={() => {}} build={build} handoff={handoff} />);
    act(() => {
      tl().progress(1);
    });
    expect(handoffs).toHaveLength(0);
  });

  it("does not hand off when the textures arrive before the floor has run", () => {
    const { build, trace, handoff, handoffs } = capture();
    const { rerender } = render(<IntroSplash ready={false} onDone={() => {}} build={build} handoff={handoff} />);
    rerender(<IntroSplash ready onDone={() => {}} build={build} handoff={handoff} />);
    expect(handoffs).toHaveLength(0);
    act(() => {
      trace().start();
      trace().glide()!.progress(1);
    });
    // the rule waits on the hold, a corner short
    expect(ruleReach(splashRule())).toBeCloseTo(TRACE_HOLD, 6);
  });

  it("closes the rule and hands off once the floor has run and the textures are in", () => {
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
    expect(ruleReach(splashRule())).toBeCloseTo(1, 6);
    expect(onDone).toHaveBeenCalledTimes(1);
    // the headline lifted the settle's distance as the ink dissolved (#107): the hero's lines settle from there
    const headline = document.querySelector(`[${SPLASH_HEADLINE_ATTR}]`)!;
    expect(gsap.getProperty(headline, "y")).toBe(-HERO_SETTLE_PX);
    expect(gsap.getProperty(headline, "opacity")).toBe(1);
  });

  it("sends the mark to the nav's mark when it is laid out, and leaves the nav's copy at rest afterwards", () => {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      const inSplash = !!this.closest("[data-intro-splash]");
      const r = inSplash ? { x: 300, y: 100, width: 600, height: 640 } : { x: 40, y: 30, width: 38, height: 40 };
      return { ...r, top: r.y, left: r.x, right: r.x + r.width, bottom: r.y + r.height, toJSON: () => r } as DOMRect;
    });
    const { build, tl, handoff, handoffs } = capture();
    const { rerender, unmount } = render(
      <>
        <Stage />
        <IntroSplash ready={false} onDone={() => {}} build={build} handoff={handoff} />
      </>,
    );
    act(() => {
      tl().progress(1);
    });
    rerender(
      <>
        <Stage />
        <IntroSplash ready onDone={() => {}} build={build} handoff={handoff} />
      </>,
    );
    const nav = document.querySelector(NAV_MARK) as SVGSVGElement;
    const traveller = document.querySelector("[data-intro-splash] [data-g-mark]") as SVGSVGElement;
    // the nav's copy hides while the traveller is on its way
    expect(nav.style.opacity).toBe("0");
    act(() => {
      handoffs[0].progress(0.5);
    });
    expect(traveller.style.transform).not.toBe("");
    act(() => {
      handoffs[0].progress(1);
    });
    expect(nav.style.opacity).toBe("");
    unmount();
    expect(nav.style.opacity).toBe("");
    expect(nav.style.transform).toBe("");
  });

  it("fades the mark in place when the nav has no mark to land on", () => {
    const { build, tl, handoff, handoffs } = capture();
    const { rerender } = render(<IntroSplash ready={false} onDone={() => {}} build={build} handoff={handoff} />);
    act(() => {
      tl().progress(1);
    });
    rerender(<IntroSplash ready onDone={() => {}} build={build} handoff={handoff} />);
    act(() => {
      handoffs[0].progress(1);
    });
    const mark = document.querySelector("[data-intro-splash] [data-g-mark]") as SVGSVGElement;
    expect(mark.style.opacity).toBe("0");
  });

  it("hands off only once even as the gate inputs keep changing", () => {
    const { build, tl, handoff, handoffs } = capture();
    const onDone = vi.fn();
    const { rerender } = render(<IntroSplash ready onDone={onDone} build={build} handoff={handoff} />);
    act(() => {
      tl().progress(1);
    });
    rerender(<IntroSplash ready skipped onDone={onDone} build={build} handoff={handoff} />);
    expect(handoffs).toHaveLength(1);
  });

  it("a skipped splash with textures in hands off without waiting out the floor", () => {
    const { build, tl, handoff, handoffs } = capture();
    const onDone = vi.fn();
    const { rerender } = render(<IntroSplash ready={false} onDone={onDone} build={build} handoff={handoff} />);
    rerender(<IntroSplash ready skipped onDone={onDone} build={build} handoff={handoff} />);
    expect(handoffs).toHaveLength(1);
    // the floor is jumped to its end so the rule closes from the hold
    expect(tl().progress()).toBe(1);
    act(() => {
      handoffs[0].progress(1);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("a skip before the textures are in still waits on ink", () => {
    const { build, handoff, handoffs } = capture();
    const { rerender } = render(<IntroSplash ready={false} onDone={() => {}} build={build} handoff={handoff} />);
    rerender(<IntroSplash ready={false} skipped onDone={() => {}} build={build} handoff={handoff} />);
    expect(handoffs).toHaveLength(0);
  });

  it("holds the parallax on ink while mounted and fades it up through the handoff", () => {
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

    it.each([
      ["a click", () => fireEvent.pointerDown(window)],
      ["a keypress", () => fireEvent.keyDown(window, { key: "Enter" })],
      ["a wheel scroll", () => fireEvent.wheel(window, { deltaY: 40 })],
      ["a touch scroll", () => fireEvent.touchMove(window)],
    ] as const)("%s during the splash jumps the floor to its end and, with textures in, hands off", (_gesture, dispatch) => {
      const { tl, handoffs, onDone } = mountSkippable();
      expect(tl().progress()).toBeLessThan(1);
      act(() => {
        dispatch();
      });
      expect(tl().progress()).toBe(1);
      expect(handoffs).toHaveLength(1);
      act(() => {
        handoffs[0].progress(1);
      });
      expect(onDone).toHaveBeenCalledTimes(1);
    });

    it("a skip before the textures are in does not hand off until ready flips", () => {
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
