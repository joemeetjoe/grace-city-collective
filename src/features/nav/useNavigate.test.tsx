import { fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";


import { JumpProvider } from "@/app/jumpContext";

import { useNavigate } from "./useNavigate";

afterEach(() => {
  document.body.innerHTML = "";
});

function Link({ id }: { id: "give" | "visit" }) {
  const navigate = useNavigate();
  return (
    <a href={`#${id}`} onClick={navigate(id)}>
      {id}
    </a>
  );
}

describe("useNavigate", () => {
  it("keeps the browser off the hash and jumps to the section through the provided jump", () => {
    const jump = vi.fn();
    const { container } = render(
      <JumpProvider jump={jump}>
        <Link id="give" />
      </JumpProvider>,
    );
    const followed = fireEvent.click(container.querySelector("a")!);
    expect(followed).toBe(false);
    expect(jump).toHaveBeenCalledTimes(1);
    expect(jump).toHaveBeenCalledWith("give");
  });

  it("without a provider a click still keeps the browser off the hash and scrolls to the section natively", () => {
    const target = document.createElement("section");
    target.id = "give";
    document.body.appendChild(target);
    const scrollTo = vi.fn();
    vi.stubGlobal("scrollTo", scrollTo);
    const { container } = render(<Link id="give" />);
    const followed = fireEvent.click(container.querySelector("a")!);
    expect(followed).toBe(false);
    expect(scrollTo).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it("hands back the same handler factory across renders", () => {
    const seen: unknown[] = [];
    function Probe() {
      seen.push(useNavigate());
      return null;
    }
    const { rerender } = render(<Probe />);
    rerender(<Probe />);
    expect(seen).toHaveLength(2);
    expect(seen[0]).toBe(seen[1]);
  });
});
