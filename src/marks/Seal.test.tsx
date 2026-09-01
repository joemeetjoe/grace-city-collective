import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { baseMarkup } from "@/test/sealMarkup";

import Seal from "./Seal";

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

describe("Seal at rest", () => {
  it("mounts the live overlay hidden, filters and all, until a beat shows it", () => {
    const { container } = render(<Seal variant="live" atRest />);
    const overlay = container.querySelector('[data-seal="live"]') as SVGGElement;
    expect(overlay).not.toBeNull();
    expect(overlay.style.display).toBe("none");
    expect(overlay.querySelectorAll("filter").length).toBeGreaterThan(0);

    const { container: shown } = render(<Seal variant="live" />);
    expect((shown.querySelector('[data-seal="live"]') as SVGGElement).style.display).toBe("");
  });
});

describe("Seal at rest — cached raster", () => {
  it("shows a raster of its own live look so no filter is paid for at rest", async () => {
    const { container, findByTestId } = render(<Seal variant="live" atRest data-testid="seal" />);
    await findByTestId("seal");
    await new Promise((r) => setTimeout(r, 0));
    const rest = container.querySelector('image[data-seal="rest"]');
    expect(rest).not.toBeNull();
    const href = rest!.getAttribute("href") ?? "";
    expect(href.startsWith("data:image/svg+xml")).toBe(true);
    const svg = decodeURIComponent(href.slice(href.indexOf(",") + 1));
    expect(svg).toContain('data-seal="live"');
    expect(svg).not.toContain('data-seal="rest"');
    expect(svg).not.toMatch(/data-seal="live"[^>]*display:\s*none/);
    // the raster sits under the overlay so the stamp still plays on top of it
    const overlay = container.querySelector('[data-seal="live"]')!;
    expect(rest!.compareDocumentPosition(overlay) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("renders no raster when it is not at rest", () => {
    const { container } = render(<Seal variant="live" />);
    expect(container.querySelector('[data-seal="rest"]')).toBeNull();
  });
});

