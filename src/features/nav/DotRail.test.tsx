import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { site } from "@/content/site";
import { sectionMarkers } from "@/scroll/markers";

import DotRail from "./DotRail";

const markers = sectionMarkers(site);

describe("DotRail", () => {
  it("is a landmark with one link per section, each named after its section", () => {
    render(<DotRail markers={markers} activeId={null} />);
    const rail = screen.getByRole("navigation", { name: "Sections" });
    const links = Array.from(rail.querySelectorAll("a"));
    expect(links.map((a) => a.getAttribute("href"))).toEqual(
      markers.map((m) => `#${m.id}`),
    );
    expect(links.map((a) => a.getAttribute("aria-label"))).toEqual(
      markers.map((m) => m.label),
    );
    // the label is also written out, to be revealed beside the dot
    for (const m of markers) expect(rail.textContent).toContain(m.label);
  });

  it("fills the active dot crimson and marks its link current", () => {
    const { container } = render(<DotRail markers={markers} activeId="give" />);
    const active = container.querySelector("a[href='#give']")!;
    expect(active.getAttribute("aria-current")).toBe("location");
    expect(active.querySelector("[data-dot]")!.className).toContain("bg-seal");
    const rest = Array.from(
      container.querySelectorAll("a:not([href='#give'])"),
    );
    expect(rest.length).toBe(markers.length - 1);
    for (const a of rest) {
      expect(a.getAttribute("aria-current")).toBeNull();
      expect(a.querySelector("[data-dot]")!.className).not.toContain("bg-seal");
    }
  });

  it("a click hands the id to onNavigate instead of following the hash", () => {
    const onNavigate = vi.fn();
    const { container } = render(
      <DotRail markers={markers} activeId={null} onNavigate={onNavigate} />,
    );
    const followed = fireEvent.click(
      container.querySelector("a[href='#devotions']")!,
    );
    expect(onNavigate).toHaveBeenCalledWith("devotions");
    expect(followed).toBe(false);
  });
});

describe("DotRail class lists", () => {
  const tokens = (el: Element) => el.className.split(/\s+/);

  it("stacks where its caller puts it: no z-order of its own", () => {
    const { container } = render(<DotRail markers={markers} activeId={null} className="z-40" />);
    expect(tokens(container.querySelector("nav")!).filter((c) => /^z-/.test(c))).toEqual(["z-40"]);
  });

  it("a resting dot and label wear cream; the active ones wear seal and no cream", () => {
    const { container } = render(<DotRail markers={markers} activeId="give" />);
    const rest = container.querySelector("a:not([aria-current])")!;
    const active = container.querySelector("a[aria-current='location']")!;
    const restDot = tokens(rest.querySelector("[data-dot]")!);
    const restLabel = tokens(rest.querySelector("[data-dot-label]")!);
    const activeDot = tokens(active.querySelector("[data-dot]")!);
    const activeLabel = tokens(active.querySelector("[data-dot-label]")!);
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
