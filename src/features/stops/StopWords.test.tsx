import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { button, stopBody, stopHeading } from "@/theme/classes";
import StopWords from "./StopWords";

const has = (el: Element, classes: string) =>
  classes.split(/\s+/).every((c) => el.classList.contains(c));

describe("StopWords (#121)", () => {
  it("sets the kicker, the headline, the paragraphs and the call to action, in that order, at the stop's sizes", () => {
    const { container } = render(
      <StopWords
        stop="give"
        kicker="Why we give"
        heading="Sow"
        body={["one", "two"]}
        cta={{ label: "Give now", href: "/give" }}
      />,
    );
    const tags = [...container.children].map((el) => el.tagName.toLowerCase());
    expect(tags).toEqual(["div", "h2", "p", "p", "a"]);
    expect(container.querySelector("[data-kicker-rule]")).not.toBeNull();
    const h2 = container.querySelector("h2")!;
    expect(h2.textContent).toBe("Sow");
    expect(has(h2, stopHeading({ stop: "give" }))).toBe(true);
    const ps = container.querySelectorAll("p:not(:first-child)");
    expect([...ps].map((p) => p.textContent)).toEqual(["one", "two"]);
    expect(has(ps[0], stopBody({ stop: "give" }))).toBe(true);
    const a = container.querySelector("a")!;
    expect(a.getAttribute("href")).toBe("/give");
    expect(a.textContent).toBe("Give now");
    expect(has(a, button({ intent: "seal", size: "cta" }))).toBe(true);
  });

  it("the hero's headline is the page's h1, the one the splash hands off to", () => {
    const { container } = render(<StopWords stop="hero" heading="Hello" />);
    expect(container.querySelector("h2")).toBeNull();
    const h1 = container.querySelector("h1")!;
    expect(h1.hasAttribute("data-hero-headline")).toBe(true);
    expect(has(h1, stopHeading({ stop: "hero" }))).toBe(true);
    expect(container.querySelector("[data-kicker-rule]")).toBeNull();
  });

  it("with a reveal, the words rise one after another and the kicker stands before it with the brackets", () => {
    const { container } = render(
      <StopWords stop="about" kicker="Who" heading="H" body={["a", "b"]} reveal="flex" />,
    );
    expect(container.children).toHaveLength(2);
    expect(container.firstElementChild!.querySelector("[data-kicker-rule]")).not.toBeNull();
    const reveal = container.querySelector("[data-reveal]")!;
    expect(reveal.classList.contains("flex")).toBe(true);
    const indices = [...reveal.children].map((el) => (el as HTMLElement).style.getPropertyValue("--i"));
    expect(indices).toEqual(["0", "1", "2"]);
  });

  it("or the kicker rises first with the rest (the gatherings)", () => {
    const { container } = render(
      <StopWords stop="gatherings" kicker="When" kickerRises heading="H" reveal="flex" />,
    );
    expect(container.children).toHaveLength(1);
    const reveal = container.querySelector("[data-reveal]")!;
    expect(reveal.firstElementChild!.querySelector("[data-kicker-rule]")).not.toBeNull();
    // the kicker takes no style of its own (Kicker), so the headline is the reveal's second
    expect((reveal.children[1] as HTMLElement).style.getPropertyValue("--i")).toBe("1");
  });

  it("the kicker takes its manners: centred, a margin, and when to draw its rule", () => {
    const { container } = render(
      <StopWords
        stop="visit"
        kicker="Come"
        kickerProps={{ centred: true, className: "mb-2", drawn: false }}
        heading="H"
      />,
    );
    const block = container.firstElementChild!;
    expect(block.classList.contains("items-center")).toBe(true);
    expect(block.classList.contains("mb-2")).toBe(true);
    expect(block.querySelector("[data-kicker-rule]")!.getAttribute("data-drawn")).toBe("false");
  });
});
