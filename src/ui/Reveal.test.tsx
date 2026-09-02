import { act, render } from "@testing-library/react";
import { memo } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Reveal from "./Reveal";

type Callback = (entries: Partial<IntersectionObserverEntry>[]) => void;

/** a stand-in observer the test can fire by hand */
function stubObserver() {
  const observers: { cb: Callback; el: Element | null; disconnected: boolean; threshold: unknown }[] = [];
  class IO {
    cb: Callback;
    threshold: unknown;
    record: (typeof observers)[number];
    constructor(cb: Callback, init?: IntersectionObserverInit) {
      this.cb = cb;
      this.threshold = init?.threshold;
      this.record = { cb, el: null, disconnected: false, threshold: init?.threshold };
      observers.push(this.record);
    }
    observe(el: Element) {
      this.record.el = el;
    }
    disconnect() {
      this.record.disconnected = true;
    }
    unobserve() {}
    takeRecords() {
      return [];
    }
  }
  vi.stubGlobal("IntersectionObserver", IO);
  return observers;
}

afterEach(() => vi.unstubAllGlobals());

describe("Reveal", () => {
  it("renders at rest wherever IntersectionObserver is missing", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const { container } = render(
      <Reveal>
        <p>one</p>
      </Reveal>,
    );
    expect(container.firstElementChild!.getAttribute("data-reveal")).toBe("true");
  });

  it("waits until it is seen, then comes in for good", () => {
    const observers = stubObserver();
    const { container } = render(
      <Reveal threshold={0.3}>
        <p>one</p>
      </Reveal>,
    );
    const root = container.firstElementChild!;
    expect(root.getAttribute("data-reveal")).toBe("false");
    expect(observers.length).toBe(1);
    expect(observers[0].el).toBe(root);
    expect(observers[0].threshold).toBe(0.3);
    act(() => observers[0].cb([{ isIntersecting: false }]));
    expect(root.getAttribute("data-reveal")).toBe("false");
    act(() => observers[0].cb([{ isIntersecting: true }]));
    expect(root.getAttribute("data-reveal")).toBe("true");
    // watched once: the observer is let go
    expect(observers[0].disconnected).toBe(true);
  });

  it("numbers its children for the stagger and carries the timing as custom properties", () => {
    const { container } = render(
      <Reveal as="ol" delay={200} stagger={90} className="grid">
        <li>a</li>
        <li style={{ color: "red" }}>b</li>
        <li>c</li>
      </Reveal>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.tagName).toBe("OL");
    expect(root.className).toBe("grid");
    expect(root.style.getPropertyValue("--reveal-delay")).toBe("200ms");
    expect(root.style.getPropertyValue("--reveal-stagger")).toBe("90ms");
    const items = Array.from(root.children) as HTMLElement[];
    expect(items.map((li) => li.style.getPropertyValue("--i"))).toEqual(["0", "1", "2"]);
    // a child's own style survives the numbering
    expect(items[1].style.color).toBe("red");
  });

  it("leaves its children as they are: a memoised child is not rendered again as the block comes in, and stays numbered", () => {
    const observers = stubObserver();
    let renders = 0;
    const Word = memo(function Word({ text }: { text: string }) {
      renders += 1;
      return <p>{text}</p>;
    });
    const { container, rerender } = render(
      <Reveal>
        <Word text="one" />
        <Word text="two" />
      </Reveal>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(renders).toBe(2);
    act(() => observers[0].cb([{ isIntersecting: true }]));
    expect(root.getAttribute("data-reveal")).toBe("true");
    expect(renders).toBe(2);
    // and re-numbered when the children change
    rerender(
      <Reveal>
        <Word text="one" />
        <Word text="two" />
        <p>three</p>
      </Reveal>,
    );
    expect(renders).toBe(2);
    const items = Array.from(root.children) as HTMLElement[];
    expect(items.map((el) => el.style.getPropertyValue("--i"))).toEqual(["0", "1", "2"]);
  });

  it("follows `shown` instead of the viewport when driven, both ways", () => {
    const observers = stubObserver();
    const { container, rerender } = render(
      <Reveal shown={false}>
        <p>one</p>
      </Reveal>,
    );
    const root = container.firstElementChild!;
    expect(root.getAttribute("data-reveal")).toBe("false");
    expect(observers.length).toBe(0);
    rerender(
      <Reveal shown>
        <p>one</p>
      </Reveal>,
    );
    expect(root.getAttribute("data-reveal")).toBe("true");
    rerender(
      <Reveal shown={false}>
        <p>one</p>
      </Reveal>,
    );
    expect(root.getAttribute("data-reveal")).toBe("false");
  });
});
