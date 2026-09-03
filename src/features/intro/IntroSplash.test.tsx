import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import GMark from "@/marks/GMark";
import { gsap } from "@/lib/gsap";
import { site } from "@/content/site";
import { REST_STATE, useAppStore } from "@/state/appStore";
import { registerRevealTarget, revealRef } from "@/state/revealTargets";
import IntroSplash from "./IntroSplash";
import { buildHandoff, navMark } from "./handoff";
import { HERO_SETTLE_PX } from "./heroRise";
import { createIntroController, type IntroController } from "./introMachine";
import { SPLASH_MARK_SIZE } from "./splashMark";
import { LIVE_SPLASH_ATTR, SPLASH_HEADLINE_ATTR, STATIC_SPLASH_ATTR, staticSplashMarkup } from "./staticSplash";
import { removeStaticSplash } from "./staticSplashDom";
import { TRACE_HOLD, ruleReach } from "./trace";

/** a controller factory that hands the controller and its handoff timelines back to the test, to scrub them */
function capture() {
  const controllers: IntroController[] = [];
  const handoffs: gsap.core.Timeline[] = [];
  const handoff: typeof buildHandoff = (ctx) => {
    const tl = buildHandoff(ctx);
    handoffs.push(tl);
    return tl;
  };
  const create: typeof createIntroController = (deps) => {
    const controller = createIntroController({ ...deps, handoff });
    controllers.push(controller);
    return controller;
  };
  const ctrl = () => controllers[0];
  return { create, ctrl, tl: () => ctrl().trace.timeline, trace: () => ctrl().trace, handoffs };
}

/** the nav mark and the parallax scene the splash hands off to, registered as the page registers them */
function Stage() {
  return (
    <>
      <div data-parallax="" ref={revealRef("parallax")} />
      <div data-parallax-front="" ref={revealRef("parallax")} />
      <nav>
        <a href="#hero" ref={revealRef("mark")}>
          <GMark size={40} ruled />
        </a>
      </nav>
    </>
  );
}

const splashRule = () => document.querySelector<SVGPathElement>("[data-intro-splash] [data-g-mark-rule]")!;

describe("navMark", () => {
  it("picks the registered nav mark that is laid out, whichever breakpoint's it is", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <a id="phone"><svg data-g-mark=""></svg></a>
      <a id="xl"><svg data-g-mark=""></svg></a>`;
    const links = Array.from(root.querySelectorAll("a"));
    const off = links.map((a) => registerRevealTarget("mark", a));
    const rect = (w: number) =>
      ({ x: 0, y: 0, width: w, height: w, top: 0, left: 0, right: w, bottom: w, toJSON: () => ({}) }) as DOMRect;
    const marks = links.map((a) => a.querySelector("svg")!);
    vi.spyOn(marks[0], "getBoundingClientRect").mockReturnValue(rect(0));
    vi.spyOn(marks[1], "getBoundingClientRect").mockReturnValue(rect(40));
    expect(navMark()?.parentElement?.id).toBe("xl");
    vi.spyOn(marks[0], "getBoundingClientRect").mockReturnValue(rect(40));
    vi.spyOn(marks[1], "getBoundingClientRect").mockReturnValue(rect(0));
    expect(navMark()?.parentElement?.id).toBe("phone");
    // neither laid out: no destination, so the handoff fades the mark in place
    vi.spyOn(marks[0], "getBoundingClientRect").mockReturnValue(rect(0));
    expect(navMark()).toBeNull();
    // and once the nav has unregistered, nothing to land on
    for (const f of off) f();
    vi.spyOn(marks[1], "getBoundingClientRect").mockReturnValue(rect(40));
    expect(navMark()).toBeNull();
  });
});

// the splash reads the textures' progress and the ready signal off the store
// and finishes the intro there; each test starts with the splash up
beforeEach(() => useAppStore.setState({ ...REST_STATE, intro: true }));
afterEach(() => {
  vi.restoreAllMocks();
  useAppStore.setState(REST_STATE);
  // the adopted root leaves with the store's intro flag (useIntroReveals.ts), which nothing here renders
  removeStaticSplash();
});
/** every texture is in */
const loaded = () => useAppStore.getState().markReady();
/** the splash is still up */
const intro = () => useAppStore.getState().intro;

describe("IntroSplash", () => {
  it("covers the viewport on ink with the ruled G mark and the headline on it", () => {
    render(<IntroSplash />);
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
    const { create, tl } = capture();
    render(<IntroSplash create={create} />);
    expect(ruleReach(splashRule())).toBe(0);
    act(() => {
      tl().progress(1);
    });
    expect(ruleReach(splashRule())).toBeCloseTo(TRACE_HOLD, 6);
  });

  it("the textures pull the rule ahead of the floor, gliding out to their share", () => {
    const { create, ctrl, trace } = capture();
    render(<IntroSplash create={create} />);
    act(() => useAppStore.setState({ progress: 0.5 }));
    // nothing has moved yet: the splash has not been painted
    expect(ruleReach(splashRule())).toBe(0);
    expect(ctrl().state().phase).toBe("idle");
    act(() => {
      ctrl().start();
    });
    expect(ctrl().state().phase).toBe("tracing");
    expect(ruleReach(splashRule())).toBe(0);
    act(() => {
      trace().glide()!.progress(1);
    });
    expect(ruleReach(splashRule())).toBeCloseTo(0.5 * TRACE_HOLD, 6);
  });

  it("starts the trace on the frame after its first paint, and not before", async () => {
    const { create, tl } = capture();
    render(<IntroSplash create={create} />);
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
    const { create, tl } = capture();
    const { unmount } = render(<IntroSplash create={create} />);
    unmount();
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    expect(tl().paused()).toBe(true);
  });

  it("holds gsap's clock through stalls while up, and lets it go on unmount", () => {
    const spy = vi.spyOn(gsap.ticker, "lagSmoothing");
    const { unmount } = render(<IntroSplash />);
    expect(spy).toHaveBeenLastCalledWith(100, 16);
    unmount();
    expect(spy).toHaveBeenLastCalledWith(500, 33);
  });

  it("adopts the static splash from index.html the moment it is committed: the same root, the same h1, handed to the controller", () => {
    document.body.insertAdjacentHTML("afterbegin", staticSplashMarkup());
    const stat = document.querySelector(`[${STATIC_SPLASH_ATTR}]`)!;
    const h1 = stat.querySelector(`[${SPLASH_HEADLINE_ATTR}]`)!;
    const create = vi.fn(createIntroController);
    const { unmount } = render(<IntroSplash create={create} />);
    // nothing rebuilt: the headline that painted first is the one the splash keeps (it is the LCP element, #107)
    expect(document.querySelector(`[${LIVE_SPLASH_ATTR}]`)).toBe(stat);
    expect(stat.getAttribute("aria-hidden")).toBe("true");
    expect(document.querySelectorAll(`[${STATIC_SPLASH_ATTR}]`)).toHaveLength(1);
    expect(document.querySelector(`[${SPLASH_HEADLINE_ATTR}]`)).toBe(h1);
    expect(document.querySelectorAll("h1")).toHaveLength(1);
    // the controller gets the root and its parts as elements, and the store to read and report through
    expect(create).toHaveBeenCalledOnce();
    expect(create.mock.calls[0][0]).toMatchObject({
      root: stat,
      mark: stat.querySelector("[data-g-mark]"),
      rule: stat.querySelector("[data-g-mark-rule]"),
      headline: h1,
      store: useAppStore,
      skipTarget: window,
    });
    // the root outlives the component: it leaves with the store's intro flag, in the same commit (useIntroReveals.ts)
    unmount();
    expect(document.querySelector(`[${STATIC_SPLASH_ATTR}]`)).toBe(stat);
  });

  it("does not hand off when the floor finishes before the textures are in", () => {
    const { create, ctrl, tl, handoffs } = capture();
    render(<IntroSplash create={create} />);
    act(() => {
      tl().progress(1);
    });
    expect(handoffs).toHaveLength(0);
    expect(ctrl().state()).toMatchObject({ phase: "idle", minimumElapsed: true, loaded: false });
  });

  it("does not hand off when the textures arrive before the floor has run", () => {
    const { create, ctrl, trace, handoffs } = capture();
    render(<IntroSplash create={create} />);
    act(() => loaded());
    expect(handoffs).toHaveLength(0);
    expect(ctrl().state()).toMatchObject({ phase: "idle", loaded: true, minimumElapsed: false });
    act(() => {
      ctrl().start();
      trace().glide()!.progress(1);
    });
    // the rule waits on the hold, a corner short
    expect(ruleReach(splashRule())).toBeCloseTo(TRACE_HOLD, 6);
  });

  it("closes the rule and hands off once the floor has run and the textures are in", () => {
    const { create, ctrl, tl, handoffs } = capture();
    render(
      <>
        <Stage />
        <IntroSplash create={create} />
      </>,
    );
    act(() => {
      tl().progress(1);
    });
    act(() => loaded());
    expect(handoffs).toHaveLength(1);
    expect(ctrl().handoff()).toBe(handoffs[0]);
    expect(ctrl().state().phase).toBe("handing-off");
    expect(intro()).toBe(true);
    act(() => {
      handoffs[0].progress(1);
    });
    expect(ruleReach(splashRule())).toBeCloseTo(1, 6);
    expect(ctrl().state().phase).toBe("done");
    expect(intro()).toBe(false);
    // and the store knows the intro played, for the reveals that follow the splash
    expect(useAppStore.getState().introPlayed).toBe(true);
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
    const { create, tl, handoffs } = capture();
    const { unmount } = render(
      <>
        <Stage />
        <IntroSplash create={create} />
      </>,
    );
    act(() => {
      tl().progress(1);
    });
    act(() => loaded());
    const nav = document.querySelector("nav a[href='#hero'] [data-g-mark]") as SVGSVGElement;
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
    const { create, tl, handoffs } = capture();
    render(<IntroSplash create={create} />);
    act(() => {
      tl().progress(1);
    });
    act(() => loaded());
    act(() => {
      handoffs[0].progress(1);
    });
    const mark = document.querySelector("[data-intro-splash] [data-g-mark]") as SVGSVGElement;
    expect(mark.style.opacity).toBe("0");
  });

  it("hands off only once even as the gate inputs keep coming", () => {
    const { create, ctrl, tl, handoffs } = capture();
    loaded();
    render(<IntroSplash create={create} />);
    act(() => {
      tl().progress(1);
    });
    act(() => {
      ctrl().skip();
      ctrl().start();
      useAppStore.setState({ progress: 1 });
    });
    expect(handoffs).toHaveLength(1);
    expect(ctrl().state().phase).toBe("handing-off");
  });

  it("a skipped splash with textures in hands off without waiting out the floor", () => {
    const { create, ctrl, tl, handoffs } = capture();
    render(<IntroSplash create={create} />);
    act(() => loaded());
    act(() => {
      ctrl().skip();
    });
    expect(handoffs).toHaveLength(1);
    // the floor is jumped to its end so the rule closes from the hold
    expect(tl().progress()).toBe(1);
    act(() => {
      handoffs[0].progress(1);
    });
    expect(intro()).toBe(false);
  });

  it("a skip before the textures are in still waits on ink", () => {
    const { create, ctrl, handoffs } = capture();
    render(<IntroSplash create={create} />);
    act(() => {
      ctrl().skip();
    });
    expect(handoffs).toHaveLength(0);
    expect(ctrl().state()).toMatchObject({ phase: "idle", skipped: true, minimumElapsed: true });
  });

  it("once the gate has opened before the first frame, the frame does not play the trace under the handoff", () => {
    const { create, ctrl, tl, handoffs } = capture();
    loaded();
    render(<IntroSplash create={create} />);
    act(() => {
      ctrl().skip();
    });
    expect(handoffs).toHaveLength(1);
    act(() => {
      ctrl().start();
    });
    expect(ctrl().state().phase).toBe("handing-off");
    expect(tl().progress()).toBe(1);
    expect(ctrl().trace.glide()).toBeNull();
  });

  it("holds the parallax on ink while mounted and fades it up through the handoff", () => {
    const { create, tl, handoffs } = capture();
    const { unmount } = render(
      <>
        <Stage />
        <IntroSplash create={create} />
      </>,
    );
    const parallax = document.querySelector("[data-parallax]") as HTMLElement;
    const front = document.querySelector("[data-parallax-front]") as HTMLElement;
    expect(parallax.style.opacity).toBe("0");
    expect(front.style.opacity).toBe("0");
    act(() => {
      tl().progress(1);
    });
    act(() => loaded());
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
      const { create, ctrl, tl, handoffs } = capture();
      if (ready) loaded();
      const view = render(
        <>
          <Stage />
          <IntroSplash create={create} />
        </>,
      );
      return { ...view, ctrl, tl, handoffs };
    }

    it.each([
      ["a click", () => fireEvent.pointerDown(window)],
      ["a keypress", () => fireEvent.keyDown(window, { key: "Enter" })],
      ["a wheel scroll", () => fireEvent.wheel(window, { deltaY: 40 })],
      ["a touch scroll", () => fireEvent.touchMove(window)],
    ] as const)("%s during the splash jumps the floor to its end and, with textures in, hands off", (_gesture, dispatch) => {
      const { ctrl, tl, handoffs } = mountSkippable();
      expect(tl().progress()).toBeLessThan(1);
      act(() => {
        dispatch();
      });
      expect(tl().progress()).toBe(1);
      expect(ctrl().state()).toMatchObject({ phase: "handing-off", skipped: true });
      expect(handoffs).toHaveLength(1);
      act(() => {
        handoffs[0].progress(1);
      });
      expect(intro()).toBe(false);
    });

    it("a skip before the textures are in does not hand off until ready flips", () => {
      const { tl, handoffs } = mountSkippable(false);
      act(() => {
        fireEvent.pointerDown(window);
      });
      expect(tl().progress()).toBe(1);
      expect(handoffs).toHaveLength(0);
      act(() => loaded());
      expect(handoffs).toHaveLength(1);
      act(() => {
        handoffs[0].progress(1);
      });
      expect(intro()).toBe(false);
    });

    it("gesture listeners are gone after unmount", () => {
      const { ctrl, handoffs, unmount } = mountSkippable(false);
      unmount();
      expect(() => {
        fireEvent.pointerDown(window);
        fireEvent.keyDown(window, { key: " " });
        fireEvent.wheel(window);
      }).not.toThrow();
      expect(handoffs).toHaveLength(0);
      expect(ctrl().state().skipped).toBe(false);
      expect(intro()).toBe(true);
    });

    it("a second gesture during the handoff changes nothing", () => {
      const { ctrl, handoffs } = mountSkippable();
      act(() => {
        fireEvent.pointerDown(window);
      });
      const state = ctrl().state();
      act(() => {
        fireEvent.wheel(window, { deltaY: 40 });
        fireEvent.keyDown(window, { key: "Enter" });
      });
      expect(ctrl().state()).toBe(state);
      expect(handoffs).toHaveLength(1);
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
    render(<div data-parallax="" ref={revealRef("parallax")} />);
    const parallax = document.querySelector("[data-parallax]") as HTMLElement;
    expect(parallax.style.opacity).toBe("");
  });
});
