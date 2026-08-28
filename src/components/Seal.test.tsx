import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { baseMarkup } from "@/test/sealMarkup";

import Seal from "./Seal";

describe("Seal", () => {
  it("renders an svg image with the accessible name", () => {
    render(<Seal />);
    expect(screen.getByRole("img", { name: "Grace City Collective seal" })).toBeTruthy();
  });
});

describe("Seal parts", () => {
  it("exposes the band as its own element, distinct from the fleur group", () => {
    const { container } = render(<Seal />);
    const band = container.querySelector('[data-seal="band"]');
    const fleur = container.querySelector('[data-seal="fleur"]');
    expect(band).not.toBeNull();
    expect(fleur).not.toBeNull();
    expect(band).not.toBe(fleur);
    expect(fleur!.contains(band)).toBe(false);
  });
});

describe("Seal variants", () => {
  it("renders no filters when static, and turbulence + lighting filters when live", () => {
    const { container: still } = render(<Seal variant="static" />);
    expect(still.querySelectorAll("filter")).toHaveLength(0);

    const { container: live } = render(<Seal variant="live" />);
    expect(live.querySelectorAll("filter").length).toBeGreaterThan(0);
    expect(live.querySelector("feTurbulence")).not.toBeNull();
    expect(live.querySelector("feDiffuseLighting")).not.toBeNull();
    expect(live.querySelector("feSpecularLighting")).not.toBeNull();
  });
});

describe("Seal instances", () => {
  it("do not share filter ids when two are on one page", () => {
    const { container } = render(
      <>
        <Seal variant="live" />
        <Seal variant="live" />
      </>,
    );
    const ids = Array.from(container.querySelectorAll("filter")).map((f) => f.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("Seal wax", () => {
  it("is an irregular path, not a circle", () => {
    const { container } = render(<Seal />);
    const wax = container.querySelector('[data-seal="wax"]');
    expect(wax?.tagName).toBe("path");
    expect(container.querySelector("circle")).toBeNull();
  });
});

describe("Seal live overlay", () => {
  it("keeps every filter inside a [data-seal=live] overlay; the static variant has no overlay", () => {
    const { container: live } = render(<Seal variant="live" />);
    const overlay = live.querySelector('[data-seal="live"]');
    expect(overlay).not.toBeNull();
    const filters = Array.from(live.querySelectorAll("filter"));
    expect(filters.length).toBeGreaterThan(0);
    for (const f of filters) expect(overlay!.contains(f)).toBe(true);
    expect(live.querySelector('[data-seal="drip"]')).not.toBeNull();

    const { container: still } = render(<Seal variant="static" />);
    expect(still.querySelector('[data-seal="live"]')).toBeNull();
    expect(still.querySelector('[data-seal="drip"]')).toBeNull();
  });
});

describe("Seal base artwork", () => {
  it("is the same markup as the static variant once the live overlay is removed", () => {
    const { container: live } = render(<Seal variant="live" />);
    const { container: still } = render(<Seal variant="static" />);
    const liveSvg = live.querySelector("svg")!;
    const stillSvg = still.querySelector("svg")!;
    expect(baseMarkup(liveSvg)).toBe(baseMarkup(stillSvg));
    const parts = (root: Element) =>
      Array.from(root.querySelectorAll("[data-seal]"))
        .filter((el) => !el.closest('[data-seal="live"]'))
        .map((el) => el.getAttribute("data-seal"));
    expect(parts(liveSvg)).toEqual(parts(stillSvg));
    expect(parts(stillSvg)).toContain("wax");
    expect(parts(stillSvg)).toContain("fleur");
    expect(parts(stillSvg)).toContain("band");
    expect(parts(stillSvg)).toContain("highlight");
  });
});
