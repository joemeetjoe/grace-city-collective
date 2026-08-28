import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import IntroSplash from "./IntroSplash";
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

/** a builder that hands the timeline back to the test so it can be scrubbed */
function capture() {
  const built: gsap.core.Timeline[] = [];
  const build: typeof buildIntroTimeline = (targets, beats, vars) => {
    const tl = buildIntroTimeline(targets, beats, vars);
    built.push(tl);
    return tl;
  };
  return { build, tl: () => built[0] };
}

afterEach(() => vi.restoreAllMocks());

describe("IntroSplash", () => {
  it("covers the viewport on ink and shows the centred lockup as a title card", () => {
    stubFontSize(120);
    const { container } = render(<IntroSplash onDone={() => {}} />);
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
    render(<IntroSplash onDone={() => {}} build={build} />);
    expect(Object.keys(tl().labels)).toEqual(expect.arrayContaining(["wordmark", "collective", "seal"]));
  });

  it("hands off to the hero once the timeline has finished and the splash has faded", () => {
    stubFontSize(120);
    const { build, tl } = capture();
    const onDone = vi.fn();
    render(<IntroSplash onDone={onDone} build={build} />);
    expect(onDone).not.toHaveBeenCalled();
    act(() => {
      tl().progress(1);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
