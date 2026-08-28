import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import StaticPoster from "./StaticPoster";

describe("StaticPoster", () => {
  it("renders the 1280 poster with the 2048 cut as a larger source, covering its container", () => {
    const { container } = render(<StaticPoster />);
    const img = container.querySelector("[data-poster] img") as HTMLImageElement;
    expect(img.getAttribute("src")).toMatch(/dore-pentecost-dark-1280.*\.webp/);
    expect(img.getAttribute("alt")).toBe("");
    const source = container.querySelector("[data-poster] source")!;
    expect(source.getAttribute("srcset")).toMatch(/dore-pentecost-dark-2048.*\.webp 2048w/);
    expect(source.getAttribute("srcset")).toMatch(/dore-pentecost-dark-1280.*\.webp 1280w/);
    expect(img.className).toContain("object-cover");
  });

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
