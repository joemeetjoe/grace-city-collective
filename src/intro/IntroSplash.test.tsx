import { act, render, screen } from "@testing-library/react";
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
    expect(parallax.style.opacity).toBe("0");
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
    unmount();
    expect(parallax.style.opacity).toBe("");
  });

  it("leaves the parallax untouched when the splash is never mounted", () => {
    render(<div data-parallax="" />);
    const parallax = document.querySelector("[data-parallax]") as HTMLElement;
    expect(parallax.style.opacity).toBe("");
  });
});
