import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SiteProvider } from "./SiteProvider";
import { useSite } from "./useSite";
import { site } from "./site";

function Name() {
  return <p data-testid="name">{useSite().name}</p>;
}

describe("SiteProvider", () => {
  it("useSite() is the built-in content outside any provider", () => {
    render(<Name />);
    expect(screen.getByTestId("name").textContent).toBe(site.name);
  });

  it("renders the built-in content at once and swaps in the source's when it differs", async () => {
    let resolve!: (value: typeof site) => void;
    const source = () => new Promise<typeof site>((r) => (resolve = r));
    render(
      <SiteProvider source={source}>
        <Name />
      </SiteProvider>,
    );
    expect(screen.getByTestId("name").textContent).toBe(site.name);

    await act(async () => resolve({ ...site, name: "Edited" }));
    expect(screen.getByTestId("name").textContent).toBe("Edited");
  });

  it("keeps the same object when the source matches the built-in content", async () => {
    const seen: unknown[] = [];
    function Spy() {
      seen.push(useSite());
      return null;
    }
    const source = async () => JSON.parse(JSON.stringify(site));
    render(
      <SiteProvider source={source}>
        <Spy />
      </SiteProvider>,
    );
    await act(async () => {});
    expect(new Set(seen).size).toBe(1);
  });
});
