import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { JumpProvider } from "@/app/JumpProvider";
import { site } from "@/content/site";
import { sectionMarkers } from "@/scroll/markers";
import { REST_STATE, useAppStore } from "@/state/appStore";
import { revealTargets } from "@/state/revealTargets";
import { NAV_GLASS, NAV_REVEAL } from "@/theme/classes";

import DotRail from "./DotRail";

const markers = sectionMarkers(site);

afterEach(() => {
  useAppStore.setState(REST_STATE);
  document.body.innerHTML = "";
});

/** the label beside a dot, and the dot itself */
const label = (a: Element) => a.querySelector("span:first-of-type")!;
const dot = (a: Element) => a.querySelector("span:last-of-type")!;

describe("DotRail", () => {
  it("is a landmark with one link per section, each named by the label written out beside its dot", () => {
    render(<DotRail markers={markers} />);
    const rail = screen.getByRole("navigation", { name: "Sections" });
    const links = Array.from(rail.querySelectorAll("a"));
    expect(links.map((a) => a.getAttribute("href"))).toEqual(
      markers.map((m) => `#${m.id}`),
    );
    // the visible label is the accessible name (#130): no aria-label to drift from it
    for (const m of markers) {
      const link = screen.getByRole("link", { name: m.label });
      expect(link.getAttribute("href")).toBe(`#${m.id}`);
      expect(link.hasAttribute("aria-label")).toBe(false);
      expect(label(link).hasAttribute("aria-hidden")).toBe(false);
      expect(dot(link).getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("fills the store's active dot crimson and marks its link current", () => {
    useAppStore.setState({ activeId: "give" });
    const { container } = render(<DotRail markers={markers} />);
    const active = container.querySelector("a[href='#give']")!;
    expect(active.getAttribute("aria-current")).toBe("location");
    expect(dot(active).className).toContain("bg-seal");
    const rest = Array.from(
      container.querySelectorAll("a:not([href='#give'])"),
    );
    expect(rest.length).toBe(markers.length - 1);
    for (const a of rest) {
      expect(a.getAttribute("aria-current")).toBeNull();
      expect(dot(a).className).not.toContain("bg-seal");
    }
  });

  it("a click jumps to the section through the provided jump instead of following the hash", () => {
    const jump = vi.fn();
    const { container } = render(
      <JumpProvider jump={jump}>
        <DotRail markers={markers} />
      </JumpProvider>,
    );
    const followed = fireEvent.click(container.querySelector("a[href='#give']")!);
    expect(followed).toBe(false);
    expect(jump).toHaveBeenCalledTimes(1);
    expect(jump).toHaveBeenCalledWith("give");
  });

  it("registers every dot, top to bottom, and its glass strip for the intro's cascade, and forgets them on unmount", () => {
    const { container, unmount } = render(<DotRail markers={markers} />);
    const links = Array.from(container.querySelectorAll("a"));
    expect(revealTargets("dot")).toEqual(links);
    expect(revealTargets("glass")).toEqual([container.querySelector(`.${NAV_GLASS}`)]);
    for (const a of links) expect(a.className.split(/\s+/)).toContain(NAV_REVEAL);
    unmount();
    expect(revealTargets("dot")).toEqual([]);
    expect(revealTargets("glass")).toEqual([]);
  });
});

describe("DotRail class lists", () => {
  const tokens = (el: Element) => el.className.split(/\s+/);

  it("stacks where its caller puts it: no z-order of its own", () => {
    const { container } = render(<DotRail markers={markers} className="z-40" />);
    expect(tokens(container.querySelector("nav")!).filter((c) => /^z-/.test(c))).toEqual(["z-40"]);
  });

  it("a resting dot and label wear cream; the active ones wear seal and no cream", () => {
    useAppStore.setState({ activeId: "give" });
    const { container } = render(<DotRail markers={markers} />);
    const rest = container.querySelector("a:not([aria-current])")!;
    const active = container.querySelector("a[aria-current='location']")!;
    const restDot = tokens(dot(rest));
    const restLabel = tokens(label(rest));
    const activeDot = tokens(dot(active));
    const activeLabel = tokens(label(active));
    expect(restDot).toEqual(expect.arrayContaining(["border-cream/55", "group-hover:border-cream"]));
    expect(restDot).not.toContain("border-seal");
    expect(restLabel).toContain("text-cream/80");
    expect(restLabel).not.toContain("text-seal");
    expect(activeDot).toEqual(expect.arrayContaining(["scale-[1.4]", "border-seal", "bg-seal", "group-hover:border-seal"]));
    expect(activeDot).not.toContain("border-cream/55");
    expect(activeDot).not.toContain("group-hover:border-cream");
    expect(activeLabel).toContain("text-seal");
    expect(activeLabel).not.toContain("text-cream/80");
  });
});
