import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Lockup from "./Lockup";

function stubFontSize(px: number) {
  const real = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((el, pseudo) => {
    const style = real(el, pseudo);
    if ((el as HTMLElement).dataset?.lockup === "wordmark") {
      Object.defineProperty(style, "fontSize", { value: `${px}px`, configurable: true });
    }
    return style;
  });
}

afterEach(() => vi.restoreAllMocks());

describe("Lockup", () => {
  it("renders the seal, the wordmark and the cursive line at hero sizes", () => {
    stubFontSize(108);
    render(<Lockup />);
    expect(screen.getByRole("img", { name: /seal/i })).toBeTruthy();
    expect(screen.getByText("Grace City")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Collective" })).toBeTruthy();
  });

  it("drops the cursive line when it would render under 18px", () => {
    stubFontSize(30);
    render(<Lockup />);
    expect(screen.getByText("Grace City")).toBeTruthy();
    expect(screen.queryByRole("img", { name: "Collective" })).toBeNull();
  });

  it("marks its parts for layout animation", () => {
    stubFontSize(108);
    const { container } = render(<Lockup />);
    for (const part of ["seal", "wordmark", "script"]) {
      expect(container.querySelector(`[data-lockup="${part}"]`), part).not.toBeNull();
    }
  });
});
