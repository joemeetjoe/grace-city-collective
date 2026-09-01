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
