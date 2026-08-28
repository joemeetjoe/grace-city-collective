import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { site } from "@/content/site";

import NavLinks from "./NavLinks";

describe("NavLinks", () => {
  it("renders one link per nav item, in order", () => {
    const { container } = render(<NavLinks items={site.nav} activeId={null} />);
    const links = Array.from(container.querySelectorAll("a"));
    expect(links.map((a) => a.getAttribute("href"))).toEqual(site.nav.map((n) => `#${n.id}`));
    expect(links.map((a) => a.textContent)).toEqual(site.nav.map((n) => n.label));
  });

  it("marks the active link: seal colour, a hairline underline, aria-current", () => {
    const { container } = render(<NavLinks items={site.nav} activeId="beliefs" />);
    const active = container.querySelector("a[href='#beliefs']")!;
    expect(active.getAttribute("aria-current")).toBe("location");
    expect(active.className).toContain("text-seal");
    expect(active.className).toMatch(/after:.*h-px/);
    for (const a of container.querySelectorAll("a:not([href='#beliefs'])")) {
      expect(a.getAttribute("aria-current")).toBeNull();
      expect(a.className).not.toContain("text-seal ");
    }
  });

  it("with no active id no link is current", () => {
    const { container } = render(<NavLinks items={site.nav} activeId={null} />);
    expect(container.querySelector("[aria-current]")).toBeNull();
  });

  it("a click hands the id to onNavigate instead of following the hash", () => {
    const onNavigate = vi.fn();
    const { container } = render(<NavLinks items={site.nav} activeId={null} onNavigate={onNavigate} />);
    const followed = fireEvent.click(container.querySelector("a[href='#faq']")!);
    expect(onNavigate).toHaveBeenCalledWith("faq");
    expect(followed).toBe(false);
  });
});
