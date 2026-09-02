import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BELOW_LG_QUERY } from "@/layout/breakpoint";

import { COLLECTIVE_TAIL, COLLECTIVE_VIEWBOX } from "./collectiveScriptMetrics";
import Lockup from "./Lockup";
import { LOCKUP_SIZE, LOCKUP_SIZE_STACKED, STACKED_SCRIPT_EM, STACKED_SEAL_EM, sealPeriodShiftEm } from "./lockupMetrics";

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

/** a phone or tablet: the viewport is below Tailwind's lg */
function belowLg() {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: query === BELOW_LG_QUERY,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

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

  it("renders the cursive line on the first commit when told to, before any measurement", () => {
    stubFontSize(0);
    const { container } = render(<Lockup script />);
    expect(container.querySelector('[data-lockup="script"]')).not.toBeNull();
  });

  it("writes Collective beside the wordmark on a shared baseline, with the seal as the full stop", () => {
    stubFontSize(108);
    const { container } = render(<Lockup />);
    const wordmark = container.querySelector('[data-lockup="wordmark"]')!;
    const script = container.querySelector('[data-lockup="script"]')!;
    const seal = container.querySelector('[data-lockup="seal"]')!;
    expect(script.parentElement).toBe(wordmark.parentElement);
    expect(wordmark.nextElementSibling).toBe(script);
    expect(wordmark.parentElement!.className).toMatch(/items-baseline/);
    expect(wordmark.compareDocumentPosition(seal) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(script.compareDocumentPosition(seal) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("sits the seal on the tail's line after the script", () => {
    stubFontSize(108);
    const wrap = render(<Lockup />).container.querySelector('[data-lockup="seal"]')!.parentElement as HTMLElement;
    expect(wrap.style.transform).toMatch(/translateY\(-?\d/);
    expect(wrap.style.transform).not.toBe("translateY(0em)");
  });

  it("sits the seal on the baseline when the script is dropped", () => {
    stubFontSize(30);
    const wrap = render(<Lockup />).container.querySelector('[data-lockup="seal"]')!.parentElement as HTMLElement;
    expect(wrap.style.transform).toBe("translateY(0em)");
  });

  it("renders the seal plain: no button, nothing interactive around it", () => {
    stubFontSize(108);
    render(<Lockup />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("is one line from lg up, at its one-line size", () => {
    stubFontSize(108);
    const root = render(<Lockup />).container.querySelector<HTMLElement>("[data-lockup='']")!;
    expect(root.hasAttribute("data-stacked")).toBe(false);
    expect(root.style.fontSize.replace(/\s/g, "")).toBe(LOCKUP_SIZE);
    expect(root.className).toMatch(/lg:flex-nowrap/);
  });
});

describe("Lockup below lg", () => {
  it("stacks: the wordmark takes the first line, Collective and the seal wrap under it, always", () => {
    belowLg();
    // the stacked clamp's floor: the one-line rule would drop the script here
    stubFontSize(34);
    const { container } = render(<Lockup />);
    const root = container.querySelector<HTMLElement>("[data-lockup='']")!;
    expect(root.hasAttribute("data-stacked")).toBe(true);
    expect(root.className).toMatch(/\bflex-wrap\b/);
    expect(root.className).toMatch(/items-baseline/);
    const wordmark = container.querySelector<HTMLElement>('[data-lockup="wordmark"]')!;
    expect(wordmark.className).toMatch(/\bbasis-full\b/);
    expect(wordmark.className).toMatch(/lg:basis-auto/);
    const script = container.querySelector<HTMLElement>('[data-lockup="script"]')!;
    expect(script).not.toBeNull();
    expect(wordmark.nextElementSibling).toBe(script);
    expect(script.compareDocumentPosition(container.querySelector('[data-lockup="seal"]')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("gives the script and the seal their stacked shares, the seal on the stacked tail line", () => {
    belowLg();
    stubFontSize(34);
    const { container } = render(<Lockup />);
    expect(container.querySelector<HTMLElement>('[data-lockup="script"]')!.style.height).toBe(`${STACKED_SCRIPT_EM}em`);
    const seal = container.querySelector<HTMLElement>('[data-lockup="seal"]')!;
    expect(seal.style.width).toBe(`${STACKED_SEAL_EM}em`);
    const shift = sealPeriodShiftEm(COLLECTIVE_TAIL, COLLECTIVE_VIEWBOX, {
      scriptEm: STACKED_SCRIPT_EM,
      sealEm: STACKED_SEAL_EM,
    });
    expect(seal.parentElement!.style.transform).toBe(`translateY(${shift}em)`);
  });

  it("defaults to its stacked size, unless told a size", () => {
    belowLg();
    stubFontSize(34);
    expect(
      render(<Lockup />).container.querySelector<HTMLElement>("[data-lockup='']")!.style.fontSize.replace(/\s/g, ""),
    ).toBe(LOCKUP_SIZE_STACKED);
    cleanup();
    expect(render(<Lockup size="20px" />).container.querySelector<HTMLElement>("[data-lockup='']")!.style.fontSize).toBe(
      "20px",
    );
  });
});

describe("the Collective script's tail", () => {
  it("records where the main stroke lifts off, so the seal can sit on its line", () => {
    stubFontSize(108);
    const { container } = render(<Lockup />);
    const d = container.querySelector('path[data-script="collective"]')!.getAttribute("d")!;
    const main = d.split(/(?=M)/).filter((s) => s.trim())[0];
    const nums = main.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
    expect(nums.slice(-2)).toEqual([COLLECTIVE_TAIL.x, COLLECTIVE_TAIL.y]);
  });
});
