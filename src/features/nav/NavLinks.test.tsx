import { fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { JumpProvider } from "@/app/JumpProvider";
import { site } from "@/content/site";
import { REST_STATE, useAppStore } from "@/state/appStore";
import { revealTargets } from "@/state/revealTargets";
import { NAV_GLASS, NAV_REVEAL } from "@/theme/classes";

import NavLinks from "./NavLinks";

afterEach(() => {
  useAppStore.setState(REST_STATE);
  document.body.innerHTML = "";
});

describe("NavLinks", () => {
  it("renders one link per nav item, in order", () => {
    const { container } = render(<NavLinks />);
    const links = Array.from(container.querySelectorAll("a"));
    expect(links.map((a) => a.getAttribute("href"))).toEqual(site.nav.map((n) => `#${n.id}`));
    expect(links.map((a) => a.textContent)).toEqual(site.nav.map((n) => n.label));
  });

  it("marks the store's active link: seal colour, a hairline underline, aria-current", () => {
    useAppStore.setState({ activeId: "beliefs" });
    const { container } = render(<NavLinks />);
    const active = container.querySelector("a[href='#beliefs']")!;
    expect(active.getAttribute("aria-current")).toBe("location");
    for (const a of container.querySelectorAll("a:not([href='#beliefs'])")) {
      expect(a.getAttribute("aria-current")).toBeNull();
    }
  });

  it("a click jumps to the section through the provided jump instead of following the hash", () => {
    const jump = vi.fn();
    const { container } = render(
      <JumpProvider jump={jump}>
        <NavLinks />
      </JumpProvider>,
    );
    const followed = fireEvent.click(container.querySelector("a[href='#give']")!);
    expect(followed).toBe(false);
    expect(jump).toHaveBeenCalledTimes(1);
    expect(jump).toHaveBeenCalledWith("give");
  });

  it("registers every link, in order, and the row's glass for the intro's cascade, and forgets them on unmount", () => {
    const { container, unmount } = render(<NavLinks />);
    const links = Array.from(container.querySelectorAll("a"));
    expect(revealTargets("link")).toEqual(links);
    expect(revealTargets("glass")).toEqual([container.firstElementChild]);
    expect(container.firstElementChild!.className.split(/\s+/)).toContain(NAV_GLASS);
    for (const a of links) expect(a.className.split(/\s+/)).toContain(NAV_REVEAL);
    unmount();
    expect(revealTargets("link")).toEqual([]);
    expect(revealTargets("glass")).toEqual([]);
  });
});

describe("NavLinks class lists", () => {
  const tokens = (el: Element) => el.className.split(/\s+/);

  it("a resting link carries the cream hover and the furled underline", () => {
    useAppStore.setState({ activeId: "beliefs" });
    const { container } = render(<NavLinks />);
    const rest = tokens(container.querySelector("a[href='#faq']")!);
    expect(rest).toContain("hover:text-cream");
    expect(rest).toContain("after:scale-x-0");
    expect(rest).not.toContain("text-seal");
    expect(rest).not.toContain("hover:text-seal");
    expect(rest).not.toContain("after:scale-x-100");
  });

  it("the active link swaps them for the seal hover and the drawn underline, carrying no cream hover", () => {
    useAppStore.setState({ activeId: "beliefs" });
    const { container } = render(<NavLinks />);
    const active = tokens(container.querySelector("a[href='#beliefs']")!);
    expect(active).toContain("text-seal");
    expect(active).toContain("hover:text-seal");
    expect(active).toContain("after:scale-x-100");
    expect(active).not.toContain("hover:text-cream");
    expect(active).not.toContain("after:scale-x-0");
  });
});
