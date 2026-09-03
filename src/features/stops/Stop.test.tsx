import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { site } from "@/content/site";
import { TUCK, stopFrame } from "@/theme/classes";
import Stop from "./Stop";

const gatherings = site.scene.find((s) => s.id === "gatherings")!;
const hero = site.scene.find((s) => s.id === "hero")!;

describe("Stop (#121)", () => {
  it("is the section, framed for its id and labelled, with its own utilities after the frame", () => {
    const { container } = render(
      <Stop section={gatherings} className="items-center">
        <p>words</p>
      </Stop>,
    );
    const section = container.querySelector("section")!;
    expect(section.id).toBe("gatherings");
    expect(section.getAttribute("data-screen-label")).toBe(gatherings.label);
    const { base, clear } = stopFrame("gatherings");
    for (const c of `${base} ${clear} items-center`.split(" ")) expect(section.classList.contains(c)).toBe(true);
    // no panel: the words stand bare in the section
    expect(container.querySelector("[data-copy-panel]")).toBeNull();
    expect(section.firstElementChild!.textContent).toBe("words");
  });

  it("the hero pads its own way, without the clearing below lg", () => {
    const { container } = render(
      <Stop section={hero} clear={false} className="flex-col">
        <h1>hi</h1>
      </Stop>,
    );
    const section = container.querySelector("section")!;
    for (const c of stopFrame("hero").clear.split(" ")) expect(section.classList.contains(c)).toBe(false);
    expect(section.classList.contains("flex-col")).toBe(true);
  });

  it("stands the words in the copy panel, with the panel's own classes and then the stop's tuck", () => {
    const ref = vi.fn();
    const { container } = render(
      <Stop section={gatherings} panel={{ ref, shown: true }} panelClassName="flex w-full">
        <p>words</p>
      </Stop>,
    );
    const panel = container.querySelector("[data-copy-panel]")!;
    expect(ref).toHaveBeenCalledWith(panel);
    for (const c of `flex w-full ${TUCK.gatherings}`.split(" ")) expect(panel.classList.contains(c)).toBe(true);
    expect(panel.querySelector("[data-corner-ornaments]")!.getAttribute("data-shown")).toBe("true");
    expect(panel.lastElementChild!.textContent).toBe("words");
  });

  it("a stop without a tuck adds none", () => {
    const visit = site.scene.find((s) => s.id === "visit")!;
    const { container } = render(
      <Stop section={visit} panel={{ ref: () => {}, shown: false }} panelClassName="flex">
        <p>words</p>
      </Stop>,
    );
    const panel = container.querySelector("[data-copy-panel]")!;
    expect(panel.className.split(/\s+/).filter(Boolean)).not.toContain("");
    expect(panel.className).not.toMatch(/--tuck/);
    expect(panel.querySelector("[data-corner-ornaments]")!.getAttribute("data-shown")).toBe("false");
  });

  it("hands the pointer's arrival and departure to the panel", () => {
    const hover = { onMouseEnter: vi.fn(), onMouseLeave: vi.fn() };
    const { container } = render(
      <Stop section={gatherings} panel={{ ref: () => {}, shown: true }} hover={hover}>
        <p>words</p>
      </Stop>,
    );
    const panel = container.querySelector("[data-copy-panel]")!;
    fireEvent.mouseEnter(panel);
    expect(hover.onMouseEnter).toHaveBeenCalledOnce();
    fireEvent.mouseLeave(panel);
    expect(hover.onMouseLeave).toHaveBeenCalledOnce();
  });
});
