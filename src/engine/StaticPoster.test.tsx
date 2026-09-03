import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import StaticPoster from "./StaticPoster";

describe("StaticPoster", () => {
  it("reports ready once the image has loaded, and only once", () => {
    const onReady = vi.fn();
    const { container } = render(<StaticPoster onReady={onReady} />);
    const img = container.querySelector("img")!;
    expect(onReady).not.toHaveBeenCalled();
    fireEvent.load(img);
    fireEvent.load(img);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("reports ready at mount when the image is already complete (cached)", () => {
    const complete = vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
    const onReady = vi.fn();
    render(<StaticPoster onReady={onReady} />);
    expect(onReady).toHaveBeenCalledTimes(1);
    complete.mockRestore();
  });

  it("a failed load still reports ready so the intro never hangs", () => {
    const onReady = vi.fn();
    const { container } = render(<StaticPoster onReady={onReady} />);
    fireEvent.error(container.querySelector("img")!);
    expect(onReady).toHaveBeenCalledTimes(1);
  });
});

import { POSTER_RUNGS } from "./posterLadder";

/** the srcset's candidates as [file, descriptor] pairs */
const candidates = (srcset: string) => srcset.split(",").map((c) => c.trim().split(/\s+/));

describe("StaticPoster's ladder", () => {
  it("offers AVIF first, then WebP, then a plain img", () => {
    const { container } = render(<StaticPoster saveData={false} />);
    const children = [...container.querySelector("picture[data-poster]")!.children];
    expect(children.map((c) => c.tagName.toLowerCase())).toEqual(["source", "source", "img"]);
    expect(children.map((c) => c.getAttribute("type"))).toEqual(["image/avif", "image/webp", null]);
  });

  it("lists every rung ascending with its w descriptor in both sources, sized to the viewport", () => {
    const { container } = render(<StaticPoster saveData={false} />);
    for (const format of ["avif", "webp"]) {
      const source = container.querySelector(`source[type="image/${format}"]`)!;
      expect(source.getAttribute("sizes")).toBe("100vw");
      const list = candidates(source.getAttribute("srcset")!);
      expect(list.map(([, d]) => d)).toEqual(POSTER_RUNGS.map((w) => `${w}w`));
      list.forEach(([file], i) => expect(file).toMatch(new RegExp(`dore-pentecost-dark-${POSTER_RUNGS[i]}\\b.*\\.${format}$`)));
    }
    expect(container.querySelector("img")!.getAttribute("src")).toMatch(/dore-pentecost-dark-640\b.*\.webp$/);
  });

  it("under Save-Data ships the smallest rung alone, with no srcset for the browser to upgrade", () => {
    const { container } = render(<StaticPoster saveData />);
    const sources = [...container.querySelectorAll("source")];
    expect(sources.map((s) => s.getAttribute("type"))).toEqual(["image/avif"]);
    expect(sources[0].getAttribute("srcset")).toMatch(/^[^,\s]*dore-pentecost-dark-640\b[^,\s]*\.avif$/);
    expect(sources[0].hasAttribute("sizes")).toBe(false);
    const img = container.querySelector("img")!;
    expect(img.getAttribute("src")).toMatch(/dore-pentecost-dark-640\b.*\.webp$/);
    expect(img.hasAttribute("srcset")).toBe(false);
  });

  it("reads Save-Data from the connection hint by default, the seam useDeviceProfile reads", () => {
    Object.defineProperty(navigator, "connection", { value: { saveData: true }, configurable: true });
    try {
      const { container } = render(<StaticPoster />);
      expect(container.querySelectorAll("source")).toHaveLength(1);
    } finally {
      delete (navigator as Navigator & { connection?: unknown }).connection;
    }
    const { container } = render(<StaticPoster />);
    expect(container.querySelectorAll("source")).toHaveLength(2);
  });
});
