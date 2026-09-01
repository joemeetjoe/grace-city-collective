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
